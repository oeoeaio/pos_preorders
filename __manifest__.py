# -*- coding: utf-8 -*-
{
    'name': 'POS Pre-orders',
    'version': '1.0.1',
    'category': 'Point Of Sale',
    'author': 'Rob Harrington',
    'sequence': 10,
    'summary': 'Load preorders into the POS interface',
    'description': "",
    'depends': ['point_of_sale'],
    'data': [
      'views/preorder_views.xml'
     ],
    'qweb': ['static/src/xml/preorder_templates.xml'],
    'images': [],
    'installable': True,
    'application': False,
    'license': 'LGPL-3'
}
