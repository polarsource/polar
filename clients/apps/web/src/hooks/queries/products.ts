import { queryClient } from '@/utils/api'
import { BenefitPublicInner } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export interface Product {
  id: string
  name: string
  description: string
  media?: string
  price: number
  benefits: BenefitPublicInner[]
  created_at: string
  updated_at: string
}

const description = `# Faciat postquam populare eadem sceleratus rapuere quod

## Coniuge ignis rarescit

Lorem markdownum altera comes gravemque non quo atque perpessi in sinus, oris
serta, lucus in. Moverat sub cum aurum reserata iter, cuius, Lydas illi sentit
erigimur sonitu diro lacrimas Danai!

> Medere saevis, fortibus datum: captus, mersaeque Cithaeron? Dixerat *index et*
> eadem. Et aures nepos spectata celerique scelerata oscula inque, ora? Cur nisi
> hastae: tepere vocibus: mutati certa, faciem, in superi caput bracchia et
> vale. Bos potentia dare postquam, in sitis felices iuvenis inmunitamque
> silentia.

Vultu est est canebat in tempore cadmus. Cum fugit, grata; te a spoliis atque.
Precor corporis, miseram corpore hasta, et perque dextra, corpus. Nec parentur,
atlas, corymbis illi. Nam metalla, lentis, Bacchus falcato nec
[ingenti](http://www.vestraeut.org/), remotam famem.

## Neve nec Cecropis vultus ramis et rudis

[Excidit sulphura](http://mihi.net/) quoque Alcyone moderere sanguine sub, pete
mihi telum, de quo tuo manebit atras: ipse. Volans freta meus avibus.

> Oro nigrum urbes **mihi**, non, conplexibus genitor retia imperio pectora
> dedit: est regem Sparte canis dum. Nunc vestrae, tamen sucis. Ora adhuc
> totoque!

## Achille sit

Possidet adiit. Rector quam nec superest manus quas *quis Procrin* equidem.
Poenam lege.

    dv_dialog = only.dualVectorScalable(2 - map_x) / nativeAclNamespace;
    refresh = clean + ctr;
    safeDvd = 4;

Eburnea veneris. Circes efficerentque arte vultum finxit? Pondus modo,
[mea](http://parsque.org/), et Cecropio tereti et suos voti artes, possit:
silvas percepto quorum, relicta. Mora cum dedit mille dedit gemmae et poenam
rogando pascua, viridi malis fugit lanificae vulnere arsit, neci!`

export let products: Product[] = [
  {
    id: '1',
    name: 'Bitspace Alpha Access',
    description,
    price: 1500,
    benefits: [
      {
        id: '123',
        description: 'Bitspace Alpha License Key',
        deletable: true,
        selectable: true,
        type: 'custom',
        created_at: new Date().toISOString(),
      },
    ],
    media:
      'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-uNOjlhlA1jNCzDcYXCtAJ9Xtdcqh1q.png',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Bitspace Repository Access',
    description,
    price: 9900,
    benefits: [
      {
        id: '123',
        description: 'Bitspace Repository Access',
        deletable: true,
        selectable: true,
        type: 'github_repository',
        created_at: new Date().toISOString(),
      },
    ],
    media:
      'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-TRZJDWeGWdRElWTvHOeOLsnpzpbXEZ.png',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'A very precious product',
    description,
    price: 500,
    benefits: [],
    media:
      'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-rW1yo7hHm6Os3twnNKtrcVfoxeBYFf.png',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const useProducts = (orgName?: string) =>
  useQuery({
    queryKey: ['products', 'organization', orgName],
    queryFn: () => {
      return new Promise<{ items: Product[] }>((resolve) => {
        resolve({
          items: products,
        })
      })
    },
    retry: defaultRetry,
    enabled: !!orgName,
  })

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ['products', 'id', id],
    queryFn: () => {
      return new Promise<Product | undefined>((resolve) => {
        resolve(products.find((product) => product.id === id))
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (orgName?: string) =>
  useMutation({
    mutationFn: (
      productCreate: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      return new Promise((resolve) => {
        products = [
          ...products,
          {
            id: (Math.random() * 1000).toString(),
            ...productCreate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        resolve(productCreate)
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', 'organization', orgName],
      })
    },
  })

export const useUpdateProduct = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      productUpdate,
    }: {
      id: string
      productUpdate: Omit<Product, 'id' | 'created_at' | 'updated_at'>
    }) => {
      return new Promise((resolve) => {
        products = [
          ...products.filter((product) => product.id !== id),
          {
            id: (Math.random() * 1000).toString(),
            ...productUpdate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        resolve(productUpdate)
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', 'organization', orgName],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', 'id', _variables.id],
      })
    },
  })
