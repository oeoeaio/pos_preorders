import logging

from odoo import models, fields

_logger = logging.getLogger(__name__)

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    default_preorder_message = fields.Text('Default Message', default_model='pos.preorder.sms.broadcast')
    default_preorder_reply_to = fields.Char(string='Default Reply To', default_model='pos.preorder.sms.broadcast')
