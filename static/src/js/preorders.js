odoo.define('pos.preorders', function (require) {
"use strict";

var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var core = require('web.core');
var PopupWidget = require('point_of_sale.popups');
var rpc = require('web.rpc');

var QWeb = core.qweb;

var _super_order = models.Order.prototype;
models.Order = models.Order.extend({
    export_as_JSON: function() {
        var json = _super_order.export_as_JSON.apply(this,arguments);
        json.preorder_ids = this.preorder_ids || [];
        return json;
    },
    init_from_JSON: function(json) {
        _super_order.init_from_JSON.apply(this,arguments);
        this.preorder_ids = json.preorder_ids || [];
    },
});

var five_days_ago = moment().subtract(5, 'days').utc().format('YYYY-MM-DD HH:mm:ss')

var _super_pos = models.PosModel.prototype;
models.PosModel = models.PosModel.extend({
    refresh_preorder_states: function(){
        var self = this;
        var def  = new $.Deferred();
        var fields = ['state','write_date'];
        var domain = [['pack_day','>',five_days_ago],['write_date','>',this.db.get_preorder_write_date()]];
        rpc.query({
                model: 'pos.preorder',
                method: 'search_read',
                args: [domain, fields],
            }, {
                timeout: 3000,
                shadow: true,
            })
            .then(function(preorders){
                if (self.db.add_preorders(preorders)) {   // check if the preorders we got were real updates
                    var ids = preorders.map(function(p){return p.id;})
                    def.resolve(ids);
                } else {
                    def.reject();
                }
            }, function(type,err){ def.reject(); });
        return def;
    },
});

// At POS Startup, load the preorders, and add them to the pos model
models.load_models({
    model: 'pos.preorder',
    fields: ['partner_id','state','amount_total','amount_paid','write_date'],
    domain: [['pack_day','>',five_days_ago]],
    loaded: function(self,preorders){
        self.db.preorder_sorted = [];
        self.db.preorder_by_id = {};
        self.db.preorder_search_string = "";
        self.db.preorder_write_date = null;
        self.db.add_preorders(preorders);
    },
});

// At POS Startup, after the preorders are loaded, load the preorder lines, and associate
// them with their preorder.
models.load_models({
    model: 'pos.preorder.line',
    fields: ['preorder_id','product_id','qty'],
    domain: [['pack_day','>',five_days_ago]],
    loaded: function(self,lines){
        self.db.preorder_lines_by_id = {};
        self.db.add_preorder_lines(lines);
    },
});


// At POS Startup, after the preorders are loaded, load the prepayments, and associate
// them with their preorder.
// models.load_models({
//     model: 'pos.prepayment',
//     fields: ['preorder_id','journal_id','amount'],
//     domain: [['pack_day','>',five_days_ago]],
//     loaded: function(self,payments){
//         self.db.prepayments_by_id = {};
//         self.db.add_prepayments(payments);
//     },
// });


// The screen that allows you to select the floor, see and select the table,
// as well as edit them.
var PreorderListScreenWidget = screens.ScreenWidget.extend({
    template: 'PreorderListScreenWidget',

    init: function(parent, options) {
        this._super(parent, options);
        this.preorder_cache = new screens.DomCache();

        this.pos.get('orders').bind('add',this.refresh_preorder_states, this)
    },

    auto_back: true,

    show: function(){
        var self = this;
        this._super();

        this.renderElement();
        this.details_visible = false;
        this.old_client = this.pos.get_order().get_client();

        this.$('.back').click(function(){
            self.gui.back();
        });

        this.$('.next').click(function(){
            self.save_changes();
        });

        var preorders = this.pos.db.get_preorders_sorted(1000);
        this.render_list(preorders);

        // if( this.old_client ){
        //     this.display_client_details('show',this.old_client,0);
        // }

        this.$('.preorder-list-contents').delegate('.preorder-line','click',function(event){
            self.line_select(event,$(this),parseInt($(this).data('id')));
        });

        var search_timeout = null;

        if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
            this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
        }

        this.$('.searchbox input').on('keypress',function(event){
            clearTimeout(search_timeout);

            var searchbox = this;

            search_timeout = setTimeout(function(){
                self.perform_search(searchbox.value, event.which === 13);
            },70);
        });

        this.$('.searchbox .search-clear').click(function(){
            self.clear_search();
        });

        this.$('.searchbox input').focus();
    },
    hide: function () {
        this._super();
        this.selected_preorder = null;
        this.selected_client = null;
    },
    perform_search: function(query, associate_result){
        var preorders;
        if(query){
            preorders = this.pos.db.search_preorder(query);
            // this.display_preorder_details('hide');
            if ( associate_result && preorders.length === 1){
                this.selected_preorder = preorders[0];
                this.selected_client = preorders[0].customer;
                this.save_changes();
            }
            this.render_list(preorders);
        }else{
            preorders = this.pos.db.get_preorders_sorted();
            this.render_list(preorders);
        }
    },
    clear_search: function(){
        var preorders = this.pos.db.get_preorders_sorted(1000);
        this.render_list(preorders);
        this.$('.searchbox input')[0].value = '';
        this.$('.searchbox input').focus();
    },
    render_list: function(preorders){
        var contents = this.$el[0].querySelector('.preorder-list-contents');
        contents.innerHTML = "";
        for(var i = 0, len = Math.min(preorders.length,1000); i < len; i++){
            var preorder     = preorders[i];
            var preorderline = this.preorder_cache.get_node(preorder.id);
            if(!preorderline){
                var preorderline_html = QWeb.render('PreorderLine',{widget: this, preorder:preorders[i]});
                var preorderline = document.createElement('tbody');
                preorderline.innerHTML = preorderline_html;
                preorderline = preorderline.childNodes[1];
                this.preorder_cache.cache_node(preorder.id,preorderline);
            }
            if( preorder.customer === this.old_client ){
                preorderline.classList.add('highlight');
            }else{
                preorderline.classList.remove('highlight');
            }
            if( preorder.state == 'to_deliver'){
                preorderline.classList.add('dulled');
            }else{
                preorderline.classList.remove('dulled');
            }
            contents.appendChild(preorderline);
        }
    },
    // add_paymentline: function(order, payment) {
    //   var cashregister;
    //   for ( var j = 0; j < this.pos.cashregisters.length; j++ ) {
    //       if ( this.pos.cashregisters[j].journal_id[0] === payment.journal_id[0] ){
    //           cashregister = this.pos.cashregisters[j];
    //           break;
    //       }
    //   }
    //
    //   var paymentline = new models.Paymentline({},{order: order, cashregister: cashregister, pos: this.pos});
    //   paymentline.set_amount(payment.amount);
    //   order.paymentlines.add(paymentline);
    // },
    clear_order: function(order){
      var orderlines = order.orderlines.models;
      while (orderlines.length > 0){
        order.remove_orderline(orderlines[0]);
      }

      // var paymentlines = order.paymentlines.models;
      // while (paymentlines.length > 0){
      //   order.remove_paymentline(paymentlines[0]);
      // }

      order.preorder_ids = [];

      order.set_client(null);
    },
    apply_preorder: function(order, preorder){
        var product;
        var line;
        for(var i = 0; i < preorder.lines.length; i++){
            line = preorder.lines[i];
            product = this.pos.db.product_by_id[line.product_id[0]];
            order.add_product(product, { quantity: line.qty });
        }
        // var payment;
        // for(var i = 0; i < preorder.payments.length; i++){
        //     payment = preorder.payments[i];
        //     this.add_paymentline(order, payment);
        // }

        order.preorder_ids.push(preorder.id);

        if (!order.client) {
            order.set_pricelist(_.findWhere(this.pos.pricelists, {'id': preorder.partner.property_product_pricelist[0]}) || this.pos.default_pricelist);
            order.set_client(preorder.partner);
        }
        this.gui.back();
    },
    save_changes: function(){
        var preorder = this.selected_preorder;
        var order = this.pos.get_order();

        order.preorder_ids = order.preorder_ids || [];

        if (order.preorder_ids.length){
            var self = this;
            self.gui.show_popup('multiple_preorder',{
                'title': 'There is already a preorder applied',
                'body':  'Would you like to replace or combine with the existing preorder?',
                replace: function(){
                  self.clear_order(order);
                  self.apply_preorder(order, preorder);
                },
                confirm: function(){
                  self.apply_preorder(order, preorder);
                },
            });
        }
        else {
            this.clear_order(order);
            this.apply_preorder(order, preorder);
        }
    },
    // has_client_changed: function(){
    //     if( this.old_client && this.new_client ){
    //         return this.old_client.id !== this.new_client.id;
    //     }else{
    //         return !!this.old_client !== !!this.new_client;
    //     }
    // },
    line_select: function(event,$line,id){
        var preorder = this.pos.db.get_preorder_by_id(id);
        this.$('.preorder-list .lowlight').removeClass('lowlight');
        if ( $line.hasClass('highlight') ){
            $line.removeClass('highlight');
            $line.addClass('lowlight');
            // this.display_preorder_details('hide',preorder);
            this.selected_preorder = null;
            this.selected_client = null;
            this.toggle_save_button();
        }else{
            this.$('.preorder-list .highlight').removeClass('highlight');
            $line.addClass('highlight');
            var y = event.pageY - $line.parent().offset().top;
            // this.display_client_details('show',partner,y);
            this.selected_preorder = preorder;
            this.selected_client = preorder.customer;
            this.toggle_save_button();
        }
    },
    refresh_preorder_states: function(){
        var self = this;
        return this.pos.refresh_preorder_states().then(function(preorder_ids){
            for (var i=0; i < preorder_ids.length; i++){
                self.preorder_cache.clear_node(preorder_ids[i]);
            }
            self.pos.trigger("preorders:updated");
        });
    },
    toggle_save_button: function(){
        var $button = this.$('.button.next');
        $button.toggleClass('oe_hidden',!this.selected_preorder);
    },
    close: function(){
        this._super();
        if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
            this.chrome.widget.keyboard.hide();
        }
    },
});
gui.define_screen({name:'preorders', widget: PreorderListScreenWidget});

var MultiplePreorderPopupWidget = PopupWidget.extend({
    template: 'MultiplePreorderPopupWidget',
    events: _.extend({}, PopupWidget.prototype.events, {
        'click .replace': 'click_replace',
    }),
    click_replace: function(){
        this.gui.close_popup();
        if (this.options.replace) {
            this.options.replace.call(this);
        }
    },
});
gui.define_popup({name:'multiple_preorder', widget: MultiplePreorderPopupWidget});

return {
    PreorderListScreenWidget: PreorderListScreenWidget,
};

});
