import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class SmsSettings(models.Model):
    _name = 'sms.settings'
    _inherit = 'res.config.settings'

    default_message = fields.Text('Default Message', default_model='pos.preorder.send_sms')
    default_reply_to = fields.Char(string='Default Reply To', default_model='pos.preorder.send_sms')
    default_username = fields.Char(string='Username', default_model='pos.preorder.send_sms')
    default_password = fields.Char(string='Password', default_model='pos.preorder.send_sms')
