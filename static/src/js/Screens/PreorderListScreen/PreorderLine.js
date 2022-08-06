odoo.define('point_of_sale.PreorderLine', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class PreorderLine extends PosComponent {
        get highlight() {
            return this.props.preorder !== this.props.selectedPreorder ? '' : 'highlight';
        }
        get to_deliver() {
            return this.props.preorder.state == 'to_deliver' ? '' : 'dulled';
        }
    }
    PreorderLine.template = 'PreorderLine';

    Registries.Component.add(PreorderLine);

    return PreorderLine;
});
