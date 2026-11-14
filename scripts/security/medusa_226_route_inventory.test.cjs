"use strict";
/** Stage12AA method-export AST tests; do not run route modules or make HTTP calls. */
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const {createRequire}=require("node:module");
const candidate=fs.realpathSync(process.env.SHQIPSHOP_MEDUSA_CANDIDATE_DIR);
const ts=createRequire(path.join(candidate,"apps/backend/package.json"))("typescript");
const {exportedMethods,inventoryPath,UNSAFE}=
  require("./medusa_226_route_inventory.cjs");
const methods=source=>exportedMethods(ts,source,"route.js");
test("compiled CommonJS exported POST and GET detected",()=>{
  assert.deepEqual(methods('exports.GET=()=>{}; exports.POST = async ()=>{}'),["GET","POST"]);
  assert.equal(UNSAFE.has("POST"),true);
  assert.equal(UNSAFE.has("GET"),false);
});
test("comments, strings and unexported local declarations are NOT methods",()=>{
  assert.deepEqual(methods([
    '// exports.POST = async () => {}',
    'const text="exports.DELETE = () => 1";',
    'const POST=()=>{}; function PATCH(){}',
    'exports.GET = () => {}',
  ].join("\n")),["GET"]);
});
test("initialization-only exports DO NOT imply a route method",()=>{
  assert.deepEqual(methods("exports.POST=void 0; exports.DELETE=exports.PATCH=void 0;"),[]);
});
test("support chains, descriptors, named ESM exports, and module.exports",()=>{
  assert.deepEqual(methods("exports.GET=exports.POST=()=>{};"),["GET","POST"]);
  assert.deepEqual(methods('Object.defineProperty(exports,"DELETE",{enumerable:true,get:()=>DELETE});'),["DELETE"]);
  assert.deepEqual(methods("export const PATCH=()=>{}; export function GET(){}"),["GET","PATCH"]);
  assert.deepEqual(methods("module.exports={PUT(){},GET:()=>{}}"),["GET","PUT"]);
});
test("method-like nested or arbitrary object references do not count",()=>{
  assert.deepEqual(methods("function nested(){return exports.POST=()=>{}}; Object.fn(exports,'GET')"),[]);
  assert.deepEqual(methods("module.other.POST=()=>{}; obj.DELETE=()=>{};"),[]);
});
test("file tree path variables are preserved as route parameters",()=>{
  assert.equal(inventoryPath("/tmp/api","/tmp/api/admin/customers/[id]/route.js"),
    "/admin/customers/:id");
  assert.equal(inventoryPath("/tmp/api","/tmp/api/health/route.js"),"/health");
  assert.throws(()=>inventoryPath("/tmp/api","/tmp/other/route.js"));
});
console.log("SHQIPSHOP_226_STAGE12AA_AST_POSITIVE_AND_NEGATIVE_UNIT_CASES");
