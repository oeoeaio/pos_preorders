# -*- coding: utf-8 -*-
{
    'name': 'POS Pre-orders',
    'version': '1.0.1',
    'category': 'Point Of Sale',
    'author': 'Rob Harrington',
    'sequence': 10,
    'summary': 'Load preorders into the POS interface',
    'description': "",
    'depends': ['point_of_sale','sms_broadcast'],
    'data': [
        'views/preorder_views.xml',
        'views/res_config_settings.xml',
        'wizard/sms_broadcast.xml',
        'security/ir.model.access.csv',
     ],
    'qweb': ['static/src/xml/preorder_templates.xml'],
    'images': [],
    'installable': True,
    'application': False,
    'license': 'LGPL-3'
}
