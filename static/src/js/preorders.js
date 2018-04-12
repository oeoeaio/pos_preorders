odoo.define('pos.preorders', function (require) {
"use strict";

var chrome = require('point_of_sale.chrome');
var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var db = require('point_of_sale.DB');
var core = require('web.core');

var QWeb = core.qweb;
var _t = core._t;

db.include({
    get_preorder_write_date: function(){
      return this.preorder_write_date || "1970-01-01 00:00:00";
    },

    add_preorders: function(preorders){
        var updated_count = 0;
        var new_write_date = '';
        var preorder;
        for(var i = 0, len = preorders.length; i < len; i++){
            preorder = preorders[i];

            var local_preorder_date = (this.preorder_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            var dist_preorder_date = (preorder.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            if (    this.preorder_write_date &&
                    this.preorder_by_id[preorder.id] &&
                    new Date(local_preorder_date).getTime() + 1000 >=
                    new Date(dist_preorder_date).getTime() ) {
                // FIXME: The write_date is stored with milisec precision in the database
                // but the dates we get back are only precise to the second. This means when
                // you read preorders modified strictly after time X, you get back preorders that were
                // modified X - 1 sec ago.
                continue;
            } else if ( new_write_date < preorder.write_date ) {
                new_write_date  = preorder.write_date;
            }
            if (!this.preorder_by_id[preorder.id]) {
                this.preorder_sorted.push(preorder.id);
            }
            preorder.lines = [];
            preorder.payments = [];
            preorder.partner = this.partner_by_id[preorder.partner_id[0]];
            this.preorder_by_id[preorder.id] = preorder;

            updated_count += 1;
        }

        this.preorder_write_date = new_write_date || this.preorder_write_date;

        if (updated_count) {
            // If there were updates, we need to completely
            // rebuild the search string

            this.preorder_search_string = "";

            var current_search_string = '';
            for (var id in this.preorder_by_id) {
                preorder = this.preorder_by_id[id];
                current_search_string = '' + preorder.id + ':' + preorder.partner.name + '\n';
                this.preorder_search_string += current_search_string;
            }
        }
        return updated_count;
    },

    get_preorder_by_id: function(id){
        return this.preorder_by_id[id];
    },

    get_preorders_sorted: function(max_count){
        max_count = max_count ? Math.min(this.preorder_sorted.length, max_count) : this.preorder_sorted.length;
        var preorders = [];
        for (var i = 0; i < max_count; i++) {
            preorders.push(this.preorder_by_id[this.preorder_sorted[i]]);
        }
        return preorders;
    },

    search_preorder: function(query){
        try {
            query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
            query = query.replace(/ /g,'.+');
            var re = RegExp("([0-9]+):.*?"+query,"gi");
        }catch(e){
            return [];
        }
        var results = [];
        for(var i = 0; i < this.limit; i++){
            var r = re.exec(this.preorder_search_string);
            if(r){
                var id = Number(r[1]);
                results.push(this.get_preorder_by_id(id));
            }else{
                break;
            }
        }
        return results;
    },

    add_preorder_lines: function(lines) {
        for (var i = 0; i < lines.length; i++) {
            this.preorder_lines_by_id[lines[i].id] = lines[i];
            var preorder = this.preorder_by_id[lines[i].preorder_id[0]];
            if (preorder) {
                preorder.lines.push(lines[i]);
                lines[i].preorder = preorder;
            }
        }
    },

    add_prepayments: function(payments) {
        for (var i = 0; i < payments.length; i++) {
            this.prepayments_by_id[payments[i].id] = payments[i];
            var preorder = this.preorder_by_id[payments[i].preorder_id[0]];
            if (preorder) {
                preorder.payments.push(payments[i]);
                payments[i].preorder = preorder;
            }
        }
    }
});

// At POS Startup, load the preorders, and add them to the pos model
models.load_models({
    model: 'pos.preorder',
    fields: ['name','partner_id'],
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
    loaded: function(self,lines){
        self.db.preorder_lines_by_id = {};
        self.db.add_preorder_lines(lines);
    },
});


// At POS Startup, after the preorders are loaded, load the prepayments, and associate
// them with their preorder.
models.load_models({
    model: 'pos.prepayment',
    fields: ['preorder_id','journal_id','amount'],
    loaded: function(self,payments){
        self.db.prepayments_by_id = {};
        self.db.add_prepayments(payments);
    },
});


// The screen that allows you to select the floor, see and select the table,
// as well as edit them.
var PreorderListScreenWidget = screens.ScreenWidget.extend({
    template: 'PreorderListScreenWidget',

    init: function(parent, options) {
        this._super(parent, options);
        this.preorder_cache = new screens.DomCache();
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
            self.gui.back();    // FIXME HUH ?
        });

        var preorders = this.pos.db.get_preorders_sorted(1000);
        this.render_list(preorders);

        // this.reload_preorders();

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
    },
    hide: function () {
        this._super();
        this.new_preorder = null;
        this.new_client = null;
    },
    perform_search: function(query, associate_result){
        var preorders;
        if(query){
            preorders = this.pos.db.search_preorder(query);
            // this.display_preorder_details('hide');
            if ( associate_result && preorders.length === 1){
                this.new_preorder = preorders[0];
                this.new_client = preorders[0].customer;
                this.save_changes();
                this.gui.back();
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
            contents.appendChild(preorderline);
        }
    },
    add_paymentline: function(order, payment) {
      var cashregister;
      for ( var j = 0; j < this.pos.cashregisters.length; j++ ) {
          if ( this.pos.cashregisters[j].journal_id[0] === payment.journal_id[0] ){
              cashregister = this.pos.cashregisters[j];
              break;
          }
      }

      var paymentline = new models.Paymentline({},{order: order, cashregister: cashregister, pos: this.pos});
      paymentline.set_amount(payment.amount);
      order.paymentlines.add(paymentline);
    },
    save_changes: function(){
        var order = this.pos.get_order();

        var orderlines = order.orderlines.models;
        while (orderlines.length > 0){
          order.remove_orderline(orderlines[0]);
        }

        var paymentlines = order.paymentlines.models;
        while (paymentlines.length > 0){
          order.remove_paymentline(paymentlines[0]);
        }

        order.set_client(null);

        var preorder = this.new_preorder;
        var product;
        var line;
        for(var i = 0; i < preorder.lines.length; i++){
            line = preorder.lines[i];
            product = this.pos.db.product_by_id[line.product_id[0]];
            order.add_product(product, { quantity: line.qty });
        }
        var payment;
        for(var i = 0; i < preorder.payments.length; i++){
            payment = preorder.payments[i];
            this.add_paymentline(order, payment);
        }

        order.set_client(preorder.partner);

        // if( this.has_client_changed() ){
        //     var default_fiscal_position_id = _.findWhere(this.pos.fiscal_positions, {'id': this.pos.config.default_fiscal_position_id[0]});
        //     if ( this.new_client && this.new_client.property_account_position_id ) {
        //         var client_fiscal_position_id = _.findWhere(this.pos.fiscal_positions, {'id': this.new_client.property_account_position_id[0]});
        //         order.fiscal_position = client_fiscal_position_id || default_fiscal_position_id;
        //         order.set_pricelist(_.findWhere(this.pos.pricelists, {'id': this.new_client.property_product_pricelist[0]}) || this.pos.default_pricelist);
        //     } else {
        //         order.fiscal_position = default_fiscal_position_id;
        //         order.set_pricelist(this.pos.default_pricelist);
        //     }
        //
        //     order.set_client(this.new_client);
        // }
    },
    has_client_changed: function(){
        if( this.old_client && this.new_client ){
            return this.old_client.id !== this.new_client.id;
        }else{
            return !!this.old_client !== !!this.new_client;
        }
    },
    line_select: function(event,$line,id){
        var preorder = this.pos.db.get_preorder_by_id(id);
        this.$('.preorder-list .lowlight').removeClass('lowlight');
        if ( $line.hasClass('highlight') ){
            $line.removeClass('highlight');
            $line.addClass('lowlight');
            // this.display_preorder_details('hide',preorder);
            this.new_preorder = null;
            this.new_client = null;
            this.toggle_save_button();
        }else{
            this.$('.preorder-list .highlight').removeClass('highlight');
            $line.addClass('highlight');
            var y = event.pageY - $line.parent().offset().top;
            // this.display_client_details('show',partner,y);
            this.new_preorder = preorder;
            this.new_client = preorder.customer;
            this.toggle_save_button();
        }
    },
    // This fetches partner changes on the server, and in case of changes,
    // rerenders the affected views
    reload_preorders: function(){
        var self = this;
        return this.pos.load_new_preorders().then(function(){
            self.render_list(self.pos.db.get_preorders_sorted(1000));

            // update the currently assigned client if it has been changed in db.
            var curr_client = self.pos.get_order().get_client();
            if (curr_client) {
                self.pos.get_order().set_client(self.pos.db.get_preorder_by_id(curr_client.id));
            }
        });
    },
    toggle_save_button: function(){
        var $button = this.$('.button.next');
        $button.toggleClass('oe_hidden',!this.new_preorder);
    },
    close: function(){
        this._super();
        if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
            this.chrome.widget.keyboard.hide();
        }
    },
});
gui.define_screen({name:'preorders', widget: PreorderListScreenWidget});

return {
    PreorderListScreenWidget: PreorderListScreenWidget,
};

});
