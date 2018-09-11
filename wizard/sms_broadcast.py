from odoo import models, fields
from odoo.exceptions import UserError

import logging

_logger = logging.getLogger(__name__)

class SmsBroadcast(models.TransientModel):
    _name = 'pos.preorder.sms.broadcast'
    _inherit = 'sms.broadcast.mixin'

    preorder_message = fields.Text('Message')
    preorder_reply_to = fields.Char('Reply To')

    def reply_to(self):
        return self._clean_number(self.preorder_reply_to)

    def message(self):
        return self.preorder_message
