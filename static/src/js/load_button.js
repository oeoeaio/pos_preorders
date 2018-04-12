odoo.define('pos.preorder.load_button', function (require) {
    "use strict";

    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');

    var LoadPreorderButton = screens.ActionButtonWidget.extend({
        template: 'LoadPreorderButton',
        button_click: function(){
            this.gui.show_screen('preorders');
        },
    });

    screens.define_action_button({
        'name': 'load_preorder',
        'widget': LoadPreorderButton,
        'condition': function(){
            return true; // TODO maybe add a config variable for this?
        },
    });
});
