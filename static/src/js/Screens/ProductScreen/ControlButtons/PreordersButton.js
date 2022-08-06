odoo.define('point_of_sale.PreordersButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');

    class PreordersButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this._onClick);
        }
        async _onClick() {
            const { confirmed, payload: selectedPreorder } = await this.showTempScreen('PreorderListScreen');

            if (!confirmed) return;

            var currentOrder = this.env.pos.get_order();

            currentOrder.preorder_ids = currentOrder.preorder_ids || [];

            if (currentOrder.preorder_ids.length){
                const { confirmed: popupConfirmed, payload } = await this.showPopup('MultiplePreorderPopup', {
                  title: 'There is already a preorder applied',
                  body:  'Would you like to replace or combine with the existing preorder?',
                });

                if (popupConfirmed) {
                  if (payload == 'replace') this.clearOrder(currentOrder);
                  this.applyPreorder(currentOrder, selectedPreorder);
                }
            }
            else {
                this.clearOrder(currentOrder);
                this.applyPreorder(currentOrder, selectedPreorder);
            }
        }
        clearOrder(order) {
          var orderlines = order.orderlines.models;
          while (orderlines.length > 0){
            order.remove_orderline(orderlines[0]);
          }

          order.preorder_ids = [];

          order.set_client(null);
        }
        applyPreorder(order, preorder) {
            var product;
            var line;
            for(var i = 0; i < preorder.lines.length; i++){
                line = preorder.lines[i];
                product = this.env.pos.db.product_by_id[line.product_id[0]];
                order.add_product(product, { quantity: line.qty });
            }
            order.preorder_ids.push(preorder.id);

            if (!order.client) {
                order.set_pricelist(_.findWhere(this.env.pos.pricelists, {'id': preorder.partner.property_product_pricelist[0]}) || this.env.pos.default_pricelist);
                order.set_client(preorder.partner);
            }
        }
    }
    PreordersButton.template = 'PreordersButton';

    ProductScreen.addControlButton({
        component: PreordersButton,
        condition: function () {
            return true;
        },
    });

    Registries.Component.add(PreordersButton);

    return PreordersButton;
});
