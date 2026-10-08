import unittest
from core.grounding import factual_issues

class CurrencyDesignationTests(unittest.TestCase):
    def test_explicit_currency_alias_does_not_require_fx_or_reconfirmation(self):
        for source,draft in [('US$ 9,579,844.00','USD 9,579,844.00'),('USD 150','US$ 150'),('MX$ 150','MXN 150'),('150 Mexican pesos','MXN 150'),('EUR 150','€150')]:
            self.assertEqual(factual_issues(source,draft),[],(source,draft))
    def test_bare_dollar_and_changed_currency_cannot_pass(self):
        for source,draft in [('$150','USD 150'),('$150','MXN 150'),('US$150','MXN 150'),('MXN 150','US$150')]:
            self.assertIn('UNSUPPORTED_CURRENCY',[x['code'] for x in factual_issues(source,draft)])
    def test_alias_does_not_allow_changed_amount(self):
        self.assertIn('UNSUPPORTED_NUMBER',[x['code'] for x in factual_issues('US$ 150','USD 180')])
