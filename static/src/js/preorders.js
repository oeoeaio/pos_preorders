odoo.define('pos.preorders', function (require) {
"use strict";

var models = require('point_of_sale.models');

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
    refresh_preorder_states: function () {
      var self = this;
      return new Promise(function (resolve, reject) {
        var fields = ['state','write_date'];
        var domain = [['pack_day','>',five_days_ago],['write_date','>',self.db.get_preorder_write_date()]];
          self.rpc({
              model: 'pos.preorder',
              method: 'search_read',
              args: [domain, fields],
          }, {
              timeout: 3000,
              shadow: true,
          })
          .then(function (preorders) {
            // let ids = [];
            if (self.db.add_preorders(preorders)) {   // check if the preorders we got were real updates
                // ids = preorders.map(function(p) { return p.id; });
                // resolve(ids);
                resolve();
            }
            else {
                reject();
            }
          }, function (type, err) { reject(); });
      });
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

});
