import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs',
    component: ComponentCreator('/docs', '1e1'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', 'da4'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '071'),
            routes: [
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', 'ec3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/contracts/carbon-credit',
                component: ComponentCreator('/docs/contracts/carbon-credit', 'e38'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/contracts/overview',
                component: ComponentCreator('/docs/contracts/overview', 'e5e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/getting-started',
                component: ComponentCreator('/docs/getting-started', '3fb'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
