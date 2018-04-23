from odoo import models, fields, api
from odoo.exceptions import UserError

import logging

_logger = logging.getLogger(__name__)

class State(models.TransientModel):
    _name = 'pos.preorder.state'

    state = fields.Selection(
        [('uncollected', 'Uncollected'), ('to_deliver', 'To Deliver'), ('cancel', 'Cancelled'),
        ('wednesday', 'Wednesday'), ('collected', 'Collected'), ('delivered', 'Delivered')],
        'Status', default='wednesday')
    update_state_date = fields.Boolean("Update timestamp?", default=True)
    record_count = fields.Integer(string='Record Count', default=0)

    def _get_records(self):
        context = dict(self._context or {})
        active_model = context.get('active_model', False)
        active_ids = context.get('active_ids', [])
        records = self.env[active_model].browse(active_ids)
        return records

    @api.model
    def default_get(self, fields):
        result = super(State, self).default_get(fields)
        records = self._get_records()
        result['record_count'] = len(records)
        return result

    @api.multi
    def action_update_state(self):
        records = self._get_records()
        hash = { 'state': self.state }

        if self.update_state_date:
            hash['state_date'] = fields.Datetime.now()

        for record in records:
            record.write(hash)

        return {}
