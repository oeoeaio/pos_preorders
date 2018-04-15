import logging

from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = "pos.order"

    # Actually One2one
    preorders = fields.One2many('pos.preorder', 'order_id', string='Preorder')

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        preorder_id = ui_order.get('preorder_id', None)
        if preorder_id and not self.preorders.browse(preorder_id).collected_date:
            order_fields['preorders'] = [[1, preorder_id, {
                'collected_date': fields.Datetime.now(),
            }]]
        return order_fields

class PosPreorder(models.Model):
    _name = "pos.preorder"
    _description = "Point of Sale Pre-Orders"
    _order = "id desc"

    @api.depends('prepayments.amount','lines.price_total')
    def _compute_amount_all(self):
        for order in self:
            order.amount_paid = 0.0
            currency = order.pricelist_id.currency_id
            order.amount_paid = currency.round(sum(payment.amount for payment in order.prepayments))
            order.amount_total = currency.round(sum(line.price_total for line in order.lines))

    def _default_pricelist(self):
        return self.env['product.pricelist'].search([('currency_id', '=', self.env.user.company_id.currency_id.id)], limit=1)

    @api.depends('partner_id.phone','partner_id.mobile')
    def _compute_phone_or_mobile(self):
        for order in self:
            order.phone = order.partner_id.mobile or order.partner_id.phone

    name = fields.Char(string='Order Ref', required=False, copy=False)
    pricelist_id = fields.Many2one('product.pricelist', string='Pricelist', required=True, readonly=True, default=_default_pricelist)
    amount_paid = fields.Float(compute='_compute_amount_all', string='Paid', digits=0)
    amount_total = fields.Float(compute='_compute_amount_all', string='Total', digits=0)
    lines = fields.One2many('pos.preorder.line', 'preorder_id', string='Pre-Order Lines', copy=True)
    prepayments = fields.One2many('pos.prepayment', 'preorder_id', string='Pre-Payments', copy=True)
    partner_id = fields.Many2one('res.partner', string='Customer', required=True, change_default=True, index=True)
    order_id = fields.Many2one('pos.order', string='POS Order', ondelete='set null')
    collected_date = fields.Datetime(string='Collected On')
    phone = fields.Char(compute='_compute_phone_or_mobile', string='Phone')

    def _get_default_sms_recipients(self):
        _logger.info("Mapped count: %s", len(self.mapped('partner_id')))
        return self.mapped('partner_id')

class PosPreorderLine(models.Model):
    _name = "pos.preorder.line"
    _description = "Lines of Point of Sale Orders"
    _rec_name = "product_id"

    # Very basic implementation to begin with
    @api.depends('qty', 'product_id')
    def _compute_amount_line_all(self):
        for line in self:
            line.price_unit = line.product_id.lst_price
            line.price_total = line.price_unit * line.qty

    product_id = fields.Many2one('product.product', string='Product', required=True, change_default=True)
    price_unit = fields.Float(compute='_compute_amount_line_all', digits=0, string='Unit Price')
    price_total = fields.Float(compute='_compute_amount_line_all', digits=0, string='Total Price')
    qty = fields.Float('Quantity', digits=dp.get_precision('Product Unit of Measure'), default=1)
    preorder_id = fields.Many2one('pos.preorder', string='Order Ref', ondelete='cascade')

class PosPrepayment(models.Model):
    _name = "pos.prepayment"
    _description = "Payments for POS Pre-Orders"

    journal_id = fields.Many2one(
        'account.journal', string='Payment Method',
        domain=[('journal_user', '=', True ), ('type', 'in', ['bank', 'cash'])],
        required=True)
    amount = fields.Float(string='Amount', digits=0)
    preorder_id = fields.Many2one('pos.preorder', string='Order Ref', ondelete='cascade')
