import logging

from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

_logger = logging.getLogger(__name__)

class PosPreorder(models.Model):
    _name = "pos.preorder"
    _description = "Point of Sale Pre-Orders"
    _order = "id desc"

    name = fields.Char(string='Order Ref', required=True, copy=False)
    # amount_total = fields.Float(compute='_compute_amount_all', string='Total', digits=0)
    lines = fields.One2many('pos.preorder.line', 'preorder_id', string='Pre-Order Lines', copy=True)
    prepayments = fields.One2many('pos.prepayment', 'preorder_id', string='Pre-Payments', copy=True)
    partner_id = fields.Many2one('res.partner', string='Customer', change_default=True, index=True)



class PosPreorderLine(models.Model):
    _name = "pos.preorder.line"
    _description = "Lines of Point of Sale Orders"
    _rec_name = "product_id"

    name = fields.Char(string='Line No', required=True, copy=False)
    product_id = fields.Many2one('product.product', string='Product', required=True, change_default=True)
    # price_unit = fields.Float(string='Unit Price', digits=0)
    qty = fields.Float('Quantity', digits=dp.get_precision('Product Unit of Measure'), default=1)
    preorder_id = fields.Many2one('pos.preorder', string='Order Ref', ondelete='cascade')


    @api.model
    def create(self, values):
        _logger.info('name values for new preorder line: %s', values.get('name'))
        if not values.get('name'):
            # fallback on any pos.preorder sequence
            values['name'] = self.env['ir.sequence'].next_by_code('pos.preorder.line')
        _logger.info('name values for new preorder line (after): %s', values.get('name'))
        return super(PosPreorderLine, self).create(values)

class PosPrepayment(models.Model):
    _name = "pos.prepayment"
    _description = "Payments for POS Pre-Orders"

    journal_id = fields.Many2one(
        'account.journal', string='Journal',
        domain=[('journal_user', '=', True ), ('type', 'in', ['bank', 'cash'])],
        required=True)
    amount = fields.Float(string='Amount', digits=0)
    preorder_id = fields.Many2one('pos.preorder', string='Order Ref', ondelete='cascade')
