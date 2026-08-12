import { describe, expect, it } from 'vitest'
import { filterRoutesByPermissions, Route } from './navigation'

const routes: Route[] = [
  {
    id: 'home',
    title: 'Home',
    link: '/home',
    if: true,
  },
  {
    id: 'products',
    title: 'Products',
    link: '/products',
    if: true,
    permission: 'products:read',
    subs: [
      { title: 'Catalogue', link: '/products' },
      {
        title: 'Checkout Links',
        link: '/products/checkout-links',
        permission: 'products:manage',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    link: '/finance',
    if: true,
    permission: 'finance:read',
    subs: [
      { title: 'Income', link: '/finance/income' },
      {
        title: 'Account',
        link: '/finance/account',
        permission: 'organization:manage',
      },
    ],
  },
  {
    id: 'members',
    title: 'Members',
    link: '/members',
    if: true,
    permission: 'members:read',
  },
]

describe('filterRoutesByPermissions', () => {
  it('keeps readable routes and removes inaccessible actions', () => {
    const visibleRoutes = filterRoutesByPermissions(routes, [
      'products:read',
      'finance:read',
    ])

    expect(visibleRoutes.map((route) => route.id)).toEqual([
      'home',
      'products',
      'finance',
    ])
    expect(visibleRoutes[1].subs?.map((route) => route.title)).toEqual([
      'Catalogue',
    ])
    expect(visibleRoutes[2].subs?.map((route) => route.title)).toEqual([
      'Income',
    ])
  })

  it('also applies feature conditions to subroutes', () => {
    const conditionalRoutes: Route[] = [
      {
        id: 'sales',
        title: 'Sales',
        link: '/sales',
        if: true,
        subs: [
          { title: 'Orders', link: '/sales' },
          { title: 'Disputes', link: '/sales/disputes', if: () => false },
        ],
      },
    ]

    const visibleRoutes = filterRoutesByPermissions(conditionalRoutes, [])

    expect(visibleRoutes[0].subs?.map((route) => route.title)).toEqual([
      'Orders',
    ])
  })
})
