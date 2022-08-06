odoo.define('point_of_sale.MultiplePreorderPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class MultiplePreorderPopup extends AbstractAwaitablePopup {
        async getPayload() {
            return 'merge';
        }

        replace() {
          this.props.resolve({ confirmed: true, payload: 'replace' });
          this.trigger('close-popup');
        }
    }
    MultiplePreorderPopup.template = 'MultiplePreorderPopup';
    MultiplePreorderPopup.defaultProps = {
        title: 'Confirm ?',
        body: '',
    };

    Registries.Component.add(MultiplePreorderPopup);

    return MultiplePreorderPopup;
});
