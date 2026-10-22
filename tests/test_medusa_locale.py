"""Localized template pack completeness smoke tests."""
import importlib.util
from pathlib import Path


def catalog():
    root=Path(__file__).parent.parent/'mobile-medusa'
    spec=importlib.util.spec_from_file_location('sq_al_catalog',root/'sq_al_catalog.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.T

def test_locale_complete_and_placeholders():
    t=catalog()
    assert len(t)>=150
    for key in ('home','cart','checkout','out-of-stock','place-order','language','shipping-address','register'):
        assert t[key]
    assert '$id' in t['order-with-id']
    assert '$count' in t['count-items']
    assert '$provider' in t['pay-using-provider']
    text=(Path(__file__).parent.parent/'mobile-medusa/sq-AL.ts').read_text()
    assert 'const sq_AL: FluentTemplate' in text
    assert 'Shporta' in text
