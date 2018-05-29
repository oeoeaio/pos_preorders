odoo.define('pos.preorders.DB', function (require) {
"use strict";

var db = require('point_of_sale.DB');

db.include({
    get_preorder_write_date: function(){
      return this.preorder_write_date || "1970-01-01 00:00:00";
    },

    add_preorder: function(preorder){
        if (this.preorder_by_id[preorder.id]){
            _.extend(this.preorder_by_id[preorder.id], preorder)
        }
        else {
            preorder.lines = [];
            preorder.payments = [];
            preorder.partner = this.partner_by_id[preorder.partner_id[0]];
            this.preorder_by_id[preorder.id] = preorder;
        }
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

            if (['uncollected','wednesday','to_deliver'].indexOf(preorder.state) > -1){
              this.add_preorder(preorder)
            }
            else {
              delete this.preorder_by_id[preorder.id]
            }

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

    get_preorders_sorted: function(){
        return Object.values(this.preorder_by_id);
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
    //
    // add_prepayments: function(payments) {
    //     for (var i = 0; i < payments.length; i++) {
    //         this.prepayments_by_id[payments[i].id] = payments[i];
    //         var preorder = this.preorder_by_id[payments[i].preorder_id[0]];
    //         if (preorder) {
    //             preorder.payments.push(payments[i]);
    //             payments[i].preorder = preorder;
    //         }
    //     }
    // }
});

});
