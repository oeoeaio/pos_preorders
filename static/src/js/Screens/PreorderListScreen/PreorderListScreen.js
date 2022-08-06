odoo.define('point_of_sale.PreorderListScreen', function(require) {
    'use strict';

    const { debounce } = owl.utils;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useAutofocus } = require('web.custom_hooks');

    /**
     * Render this screen using `showTempScreen` to select a preorder.
     * When the shown screen is confirmed ('Select Preorder button is clicked),
     * the call to `showTempScreen` resolves to the selected preorder.
     * E.g.
     * ```js
     * const { confirmed, payload: selectedPreorder } = await showTempScreen('PreorderListScreen');
     * if (confirmed) {
     *   // do something with the selectedPreorder
     * }
     * ```
     *
     * @props preorder - originally selected preorder
     */
    class PreorderListScreen extends PosComponent {
        constructor() {
            super(...arguments);

            useAutofocus({ selector: '.searchbox-preorder input' });

            // useState converts objects into Proxy which break equality testing
            // so we're modifying state directly here as per the ClientListScreen
            this.state = {
                query: null,
                selectedPreorder: null,
                selectedClient: null,
            };
            this.updatePreorderList = debounce(this.updatePreorderList, 70);

            this.env.pos.get('orders').on('add',this.refreshPreorderStates, this)
        }
        back() {
            this.props.resolve({ confirmed: false, payload: false });
            this.trigger('close-temp-screen');
        }
        confirm() {
            this.props.resolve({ confirmed: true, payload: this.state.selectedPreorder });
            this.trigger('close-temp-screen');
        }
        get preorders() {
            let preorders;
            if (this.state.query && this.state.query.trim() !== '') {
                preorders = this.env.pos.db.search_preorder(this.state.query.trim());
            } else {
                preorders = this.env.pos.db.get_preorders_sorted();
            }
            return preorders;
        }
        get isNextButtonVisible() {
            return this.state.selectedPreorder ? true : false;
        }
        // We declare this event handler as a debounce function in
        // order to lower its trigger rate.
        async updatePreorderList(event) {
            this.state.query = event.target.value;
            const preorders = this.preorders;
            if (event.code === 'Enter' && preorders.length === 1) {
                this.state.selectedPreorder = preorders[0];
                this.state.selectedClient = preorders[0].customer;
                this.confirm();
            } else {
                this.render();
            }
        }
        clickPreorder(event) {
            let preorder = event.detail.preorder;
            if (this.state.selectedPreorder === preorder) {
                this.state.selectedPreorder = null;
                this.state.selectedClient = null;
            } else {
                this.state.selectedPreorder = preorder;
                this.state.selectedClient = preorder.customer;
            }
            this.render();
        }
        refreshPreorderStates() {
            self = this;
            this.env.pos.refresh_preorder_states().then(function(){
                self.env.pos.trigger("preorders:updated");
            });
        }
    }
    PreorderListScreen.template = 'PreorderListScreen';

    Registries.Component.add(PreorderListScreen);

    return PreorderListScreen;
});
