"""Apply Albanian localization to a clean upstream medusa-mobile-react-native copy.
Default is dry-run; --apply changes files after all compatibility checks pass.
This does not connect the native app to the pilot FastAPI backend.
"""
from __future__ import annotations
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent

def patch_files(repo: Path) -> dict[Path,str]:
    if not (repo/'package.json').exists() or not (repo/'app/data/locale-context.tsx').exists():
        raise ValueError('Path must point to a Medusa Mobile source checkout.')
    edits={}
    def replace(path,old,new):
        content=edits.get(path, path.read_text(encoding='utf8'))
        if old not in content:
            raise ValueError(f'Expected source fragment not found in {path}: {old!r}. Upstream may have changed.')
        edits[path]=content.replace(old,new,1)
    src=repo/'app/constants/fluent-templates'
    if (src/'sq-AL.ts').exists():
        raise ValueError('sq-AL.ts already exists. Do not overwrite local edits.')
    edits[src/'sq-AL.ts']=(HERE/'sq-AL.ts').read_text(encoding='utf8')
    replace(src/'index.ts',"export { default as id_ID } from './id-ID';", "export { default as id_ID } from './id-ID';\nexport { default as sq_AL } from './sq-AL';")
    loc=repo/'app/data/locale-context.tsx'
    replace(loc,"import { en_US, id_ID } from '@constants/fluent-templates';", "import { en_US, id_ID, sq_AL } from '@constants/fluent-templates';")
    replace(loc,"export type Locale = 'en-US' | 'id-ID';", "export type Locale = 'en-US' | 'id-ID' | 'sq-AL';")
    replace(loc,"export const DEFAULT_LOCALE: Locale = ENV_DEFAULT_LOCALE || 'en-US';", "export const DEFAULT_LOCALE: Locale = (['en-US','id-ID','sq-AL'].includes(ENV_DEFAULT_LOCALE) ? ENV_DEFAULT_LOCALE : 'sq-AL') as Locale;")
    replace(loc,"negotiateLanguages(locales, ['en-US', 'id-ID'], {", "negotiateLanguages(locales, ['en-US', 'id-ID', 'sq-AL'], {")
    replace(loc,"""        } else {
          return [_locale, id_ID];
        }""", """        } else if (_locale === 'id-ID') {
          return [_locale, id_ID];
        } else {
          return [_locale, sq_AL];
        }""")
    replace(loc,"""      } else if (locale === 'id-ID') {
        dayjs.locale('id');
      }""", """      } else if (locale === 'id-ID') {
        dayjs.locale('id');
      } else if (locale === 'sq-AL') {
        dayjs.locale('sq');
      }""")
    settings=repo/'app/screens/settings.tsx'
    replace(settings,"z.enum(['en-US', 'id-ID']", "z.enum(['en-US', 'id-ID', 'sq-AL']")
    replace(settings,"""    label: 'Bahasa',
    value: 'id-ID',
  },""", """    label: 'Bahasa',
    value: 'id-ID',
  },
  { label: 'Shqip', value: 'sq-AL' },""")
    env=repo/'.env.template'
    replace(env,'DEFAULT_LOCALE=en-US','DEFAULT_LOCALE=sq-AL')
    return edits

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('upstream_directory',type=Path)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    edits=patch_files(args.upstream_directory.resolve())
    for path in edits:
        print('Will update:',path)
    if not args.apply:
        print('DRY RUN. Pass --apply to write changes. Back up or commit upstream first.')
        return
    for path, content in edits.items():
        path.write_text(content,encoding='utf8')
    print('Albanian locale installed. Run npm run verify and native build separately.')

if __name__=='__main__':
    main()
