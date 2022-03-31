# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools

class PosOrderTotalsReport(models.Model):
    _name = "report.pos.order_totals"
    _description = "Point of Sale Order Totals"
    _auto = False
    _order = 'date desc'

    date = fields.Date(string='Order Date', readonly=True)
    price_total = fields.Float(string='Total Price', readonly=True)
    count = fields.Integer(string='Count', readonly=True)

    def _select(self):
        return """
            SELECT
                MIN(pos_order.id) as id,
                DATE_TRUNC('day', pos_order.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Melbourne')::date as date,
                sum((pos_order_line.price_unit * pos_order_line.qty) * (100 - pos_order_line.discount) / 100) as price_total,
                count(DISTINCT pos_order.id) as count
        """

    def _from(self):
        return """
            FROM pos_order left join pos_order_line on (pos_order_line.order_id = pos_order.id)
        """

    def _group_by(self):
        return """
            GROUP BY 2
        """

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self._cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                %s
                %s
                %s
            )
        """ % (self._table, self._select(), self._from(), self._group_by())
        )
