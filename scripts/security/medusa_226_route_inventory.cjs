"use strict";
/**
 * Stage 12AA: read-only, VERSION-LOCKED route-export inventory of the
 * installed, disposable @medusajs/medusa@2.22.6 package.
 *
 * This does NOT establish authenticated session behavior, endpoint safety,
 * runtime registration, tenant authorization, or production CSRF coverage.
 * Never import/execute route handlers. The AST distinguishes actual exported
 * method identifiers from comments, strings and unexported local functions.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NS = new Set(["admin", "store", "auth"]);

function safeChild(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep)
    && !path.isAbsolute(rel);
}
function rootFromRunner() {
  const env = process.env;
  for (const [key, val] of Object.entries({
    CI: "true", NODE_ENV: "development",
    SHQIPSHOP_MEDUSA_CANDIDATE_CI: "true",
    SHQIPSHOP_REQUIRE_REDIS: "true",
  })) assert.equal(env[key], val, "Stage12AA CI scope");
  assert(/^[0-9]+$/.test(env.GITHUB_RUN_ID ?? ""), "CI run ID required");
  const temp = fs.realpathSync(env.RUNNER_TEMP);
  const root = fs.realpathSync(env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
  assert(safeChild(temp, root), "RUNNER_TEMP isolation required");
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "apps/backend/package.json")));
  assert.equal(baseline.dependencies["@medusajs/medusa"], "2.22.6");
  const packagePath = path.join(root, "apps/backend/node_modules/@medusajs/medusa");
  const physical = fs.realpathSync(packagePath);
  assert(safeChild(temp, physical), "Medusa package must be from disposable pnpm tree");
  const pkg = JSON.parse(fs.readFileSync(path.join(physical, "package.json")));
  assert.equal(pkg.name, "@medusajs/medusa");
  assert.equal(pkg.version, "2.22.6", "Exact installed version mismatch");
  const backendRequire = createRequire(path.join(root, "apps/backend/package.json"));
  const ts = backendRequire("typescript");
  return { pkg, ts, apiRoot: path.join(physical, "dist/api"), root };
}
function sortedFiles(root, dir=root) {
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const file=path.join(dir,entry.name);
    if(entry.isSymbolicLink()) throw new Error("Route inventory rejected a symlink");
    if(entry.isDirectory()) out.push(...sortedFiles(root,file));
    else if(entry.isFile() && /^route\.(?:js|mjs|cjs)$/.test(entry.name)) out.push(file);
  }
  return out;
}
function inventoryPath(apiRoot,file) {
  const rel=path.relative(apiRoot,path.dirname(file)).split(path.sep);
  assert(rel.length>=1 && rel.every(x=>x && x!=="." && x!==".."),
    "Unexpected path in compiled API package");
  return "/"+rel.map(segment=>/^\[([A-Za-z_][A-Za-z0-9_]*)\]$/.test(segment)?
    ":"+segment.slice(1,-1):segment).join("/");
}
function exportedMethods(ts, source, filename) {
  const script=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,
    filename.endsWith(".ts")?ts.ScriptKind.TS:ts.ScriptKind.JS);
  assert.equal(script.parseDiagnostics?.length??0,0,"Compiled route parse error");
  const result=new Set();
  const mark=(name)=>{if(METHODS.has(name))result.add(name)};
  const isExports=(x)=>ts.isIdentifier(x)&&x.text==="exports";
  const isModuleExports=(x)=>ts.isPropertyAccessExpression(x) &&
    ts.isIdentifier(x.expression) && x.expression.text==="module" && x.name.text==="exports";
  const propName=(x)=>x && ts.isIdentifier(x)?x.text:
    x && ts.isStringLiteral(x)?x.text:null;
  function target(x) {
    if(ts.isPropertyAccessExpression(x) &&
       (isExports(x.expression)||isModuleExports(x.expression)))return x.name.text;
    if(ts.isElementAccessExpression(x) &&
       (isExports(x.expression)||isModuleExports(x.expression)))return propName(x.argumentExpression);
    return null;
  }
  function isVoidInitializer(x) {
    if(ts.isVoidExpression(x)) return true;
    if(ts.isBinaryExpression(x)&&x.operatorToken.kind===ts.SyntaxKind.EqualsToken)
      return isVoidInitializer(x.right);
    return false;
  }
  function assignment(expr) {
    if(!ts.isBinaryExpression(expr) ||
       expr.operatorToken.kind!==ts.SyntaxKind.EqualsToken)return;
    const name=target(expr.left);
    if(name&&!isVoidInitializer(expr.right))mark(name);
    // CommonJS often chains: exports.GET = exports.POST = handler
    assignment(expr.right);
    if(isModuleExports(expr.left) && ts.isObjectLiteralExpression(expr.right)){
      for(const property of expr.right.properties){
        if(ts.isPropertyAssignment(property) ||
           ts.isShorthandPropertyAssignment(property) ||
           ts.isMethodDeclaration(property))
          mark(propName(property.name));
      }
    }
  }
  const isExported=(statement)=>statement.modifiers?.some(
    m=>m.kind===ts.SyntaxKind.ExportKeyword);
  for(const stmt of script.statements){
    if(ts.isExpressionStatement(stmt)){
      const expr=stmt.expression;
      assignment(expr);
      if(ts.isCallExpression(expr)){
        // CommonJS descriptor export emitted by compilers.
        if(ts.isPropertyAccessExpression(expr.expression) &&
           ts.isIdentifier(expr.expression.expression) &&
           expr.expression.expression.text==="Object" &&
           expr.expression.name.text==="defineProperty" &&
           isExports(expr.arguments[0]) && expr.arguments.length>=3){
          mark(propName(expr.arguments[1]));
        }
        // Some compilers use _export(exports, { GET: () => GET }).
        if(ts.isIdentifier(expr.expression)&&
           /^_?export(?:s)?$/.test(expr.expression.text)&&
           isExports(expr.arguments[0])&&ts.isObjectLiteralExpression(expr.arguments[1])){
          for(const p of expr.arguments[1].properties)
            if(ts.isPropertyAssignment(p))mark(propName(p.name));
        }
      }
    } else if(ts.isVariableStatement(stmt)&&isExported(stmt)){
      for(const d of stmt.declarationList.declarations)
        if(ts.isIdentifier(d.name))mark(d.name.text);
    } else if(ts.isFunctionDeclaration(stmt)&&isExported(stmt)){
      if(stmt.name)mark(stmt.name.text);
    } else if(ts.isExportDeclaration(stmt)&&stmt.exportClause&&
              ts.isNamedExports(stmt.exportClause)){
      for(const e of stmt.exportClause.elements)mark(e.name.text);
    }
  }
  return [...result].sort();
}
function inventoryCandidate({ts,apiRoot}) {
  assert(fs.statSync(apiRoot).isDirectory(),"Installed dist/api is unavailable");
  const files=sortedFiles(apiRoot);
  assert(files.length>=40,"Unexpectedly few compiled Medusa route modules");
  const found=new Map();
  const unresolved=[];
  for(const file of files){
    const route=inventoryPath(apiRoot,file);
    if(found.has(route))throw new Error("Duplicate compiled route URL");
    const source=fs.readFileSync(file,"utf8");
    const methods=exportedMethods(ts,source,file);
    if(methods.length===0)unresolved.push(route);
    found.set(route,methods);
  }
  const methodRows=[...found].flatMap(([route,methods])=>
    methods.map(method=>({route,method,unsafe:UNSAFE.has(method)})));
  assert(methodRows.length>=60,"Too few exported Medusa methods");
  assert(methodRows.filter(x=>x.unsafe).length>=25,"Too few unsafe Medusa methods");
  for(const [route,method] of [
    ["/store/customers/me","POST"],["/admin/customers/:id","POST"],
  ]){
    assert(found.get(route)?.includes(method),"Expected built-in mutation path missing: "+route);
  }
  assert.equal(unresolved.length,0,
    "Unresolved built-in route exports; cannot assert route inventory completeness");
  return {files,found,methodRows,unresolved};
}
function printSummary(result) {
  const counts={};
  for(const ns of NS){
    const matches=result.methodRows.filter(x=>x.route.startsWith("/"+ns+"/"));
    counts[ns]={
      routes:[...result.found.keys()].filter(x=>x.startsWith("/"+ns+"/")).length,
      exportedMethods:matches.length,
      unsafeMethods:matches.filter(x=>x.unsafe).length,
    };
  }
  const watched=[
    "/store/customers/me","/admin/customers/:id",
    "/store/carts/:id","/store/carts/:id/line-items",
    "/store/carts/:id/complete","/admin/payments/:id/refund",
  ];
  const otherNamespaces=[...new Set([...result.found.keys()]
    .map(p=>p.split("/")[1]).filter(ns=>!NS.has(ns)))].sort();
  const selected=Object.fromEntries(watched.map(p=>[p,result.found.get(p)??"NOT_IN_COMPILED_TREE"]));
  console.log("SHQIPSHOP_226_STAGE12AA_INSTALLED_EXPORT_INVENTORY",JSON.stringify({
    package:"@medusajs/medusa",version:"2.22.6",
    routeFileCount:result.files.length,
    declaredMethods:result.methodRows.length,
    declaredUnsafeMethods:result.methodRows.filter(x=>x.unsafe).length,
    unresolved:result.unresolved.length,
    namespaces:counts,otherNamespaces,watched:selected,
    authRuntimeVerified:false,sessionPolicyVerified:false,
    readOnlyMethodsSideEffectFreeVerified:false,
    productionCsrfCoverageVerified:false,
  }));
  console.log("SHQIPSHOP_226_STAGE12AA_METHOD_EXPORTS_ONLY_NO_AUTH_OR_RELEASE_CERTIFICATION");
}
if(require.main===module){
  try{const config=rootFromRunner();printSummary(inventoryCandidate(config));}
  catch{console.error("::error::SHQIPSHOP_226_STAGE12AA_INVENTORY_INCOMPLETE");process.exitCode=1;}
}
module.exports={exportedMethods,inventoryPath,inventoryCandidate,UNSAFE};
