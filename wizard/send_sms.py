from odoo import models, fields, api, _
from odoo.exceptions import UserError

import re, logging
import urllib.request, urllib.parse

_logger = logging.getLogger(__name__)

class SendSMS(models.TransientModel):
    _name = 'pos.preorder.send_sms'

    recipient_count = fields.Integer(string='Recipient Count', default=0)
    recipients = fields.Char('Recipients')
    reply_to = fields.Char('Reply To')
    username = fields.Char('Username')
    password = fields.Char('Password')
    message = fields.Text('Message')

    def _get_records(self, model):
        if self.env.context.get('active_domain'):
            records = model.search(self.env.context.get('active_domain'))
        elif self.env.context.get('active_ids'):
            records = model.browse(self.env.context.get('active_ids', []))
        else:
            records = model.browse(self.env.context.get('active_id', []))
        return records

    def _clean_number(self, number):
        if not number: return None
        stripped = ''.join(number.split())
        ex = "^\+?(61|0)?(?P<number>4[\d]{8})$"
        match = re.search(ex, stripped)
        if not match: return None
        return "61" + match.group("number")

    @api.model
    def default_get(self, fields):
        result = super(SendSMS, self).default_get(fields)
        active_model = self.env.context.get('active_model')
        model = self.env[active_model]

        records = self._get_records(model)
        if getattr(records, '_get_default_sms_recipients'):
            partners = records._get_default_sms_recipients()
            phone_numbers = []
            no_phone_partners = []
            for partner in partners:
                number = partner.mobile or partner.phone
                number = self._clean_number(number)
                if number:
                    phone_numbers.append(number)
                else:
                    no_phone_partners.append(partner.name)
            if len(partners) > 1:
                if no_phone_partners:
                    raise UserError(_('Missing mobile number for %s.') % ', '.join(no_phone_partners))
            result['recipients'] = ', '.join(phone_numbers)
            result['recipient_count'] = len(phone_numbers)

        return result

    def action_send_sms(self):
        params = {
            'username': self.username,
            'password': self.password,
            'to': self.recipients,
            'from': self.reply_to,
            'message': self.message,
        }

        encoded_params = urllib.parse.urlencode(params).encode("utf-8")
        base_url = "https://api.smsbroadcast.com.au/api-adv.php"
        response = urllib.request.urlopen(base_url, encoded_params)

        return True
