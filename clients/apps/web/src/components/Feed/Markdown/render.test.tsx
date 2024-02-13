import { article } from 'polarkit/testdata'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import Markdown from 'markdown-to-jsx'
import Paywall from './Paywall/Paywall'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

// Currently unable to use any of the "real" renderers, as we can't import the syntax highlighter in jest (?)
const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,
  },
} as const

const TestRenderer = (props: { article: RenderArticle }) => {
  return (
    <Markdown
      options={{
        ...opts,
        overrides: {
          ...opts.overrides,
          pre: () => <></>,
          Paywall: (args: any) => <Paywall {...args} />,
        },

        createElement: wrapStrictCreateElement({
          article: props.article,
        }),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

test('basic', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
  # h1

  ## h2
  
  ### h3

  Hello **world**!

  [Polar](https://polar.sh/)

  <Paywall></Paywall>

  This is a normal **block** of text [Polar](https://polar.sh/) with _various_ formatting.
  And here it continues in the same block.

  This is a different block.  
  With a linebreak! (double whitespace)

  > This is a quoute!
  
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('double-whitespace', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: 'Normal **block** example\n\nWith-doublespace  \nWith-doublespace',
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

const polarPost = `![image.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-fCQqIZt3zubCpaMQzy6ZONZAOG6QDq.png)

Today, we're thrilled to announce & launch the next chapter of Polar.

A creator platform for developers and the open source ecosystem – built open source ([fork us on GitHub](https://github.com/polarsource/polar)).

Offering you – as a developer –  a platform on top of your GitHub repositories to:
1. Build, own & reach your audience through free- and premium posts and newsletters.
2. Offer subscriptions of value-add benefits designed for our ecosystem & built-in to Polar. We'll also handle value-add taxes so you don't have to.
3. Ability to integrate it all on your own docs, sites or services using our API & SDK.

We're also excited to share our updated pricing (it's better for you) and that our team is going to subscribe to open source developers on Polar for $30K in 2024 🎉

Let's dive in.

### Subscriptions & Benefits

![Screenshot 2024-01-09 at 10.44.55.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Screenshot%202024-01-09%20at%2010.44.55-uy562dyst8J1Hk4QScE5i6DE3Aa2jA.png)

You can now setup subscriptions with Polar 🚀 They're beautiful & come with some incredibly powerful features beyond what you'd expect.

**Reach your entire audience with free tier(s)**

You automatically have a built-in - free - tier offering newsletter access to your Public Posts on Polar. Of course, you can edit it to add even more benefits too.

Enabling your entire audience to subscribe with email-only at first and for you to have one platform to reach them all.

**Paid tiers & managed value-add taxes**

Of course, you can offer paid tiers too that backers can upgrade to seamlessly over time. 

Many developers shy away from offering paid services & benefits due to the value-add tax implications. Calculating, capturing & remitting value-add taxes internationally is a crushing overhead for individual developers.

That's why we're incredibly proud to be the merchant of record and handle value-add taxes so you don't have to. Read more about the details [here](https://docs.polar.sh/payment/).

**Unparalleled business offerings**

Open source developers tend to have sponsorship tiers for individual users vs. businesses, but they're all treated the same. Not with Polar.

Polar has the concept of subscription audiences: Individual vs. Business. Separating them publicly for clarity, but also ensuring benefits are granted to all individual team members of the organization that subscribes 🤯

Offering unparalleled opportunities and value to subscriptions offered via Polar to businesses.

**Powerful, built-in, benefits** 

You can setup custom benefits with Polar (free text) for maximum flexibility. However, we're going to invest heavily in automating typical benefits offered within our ecosystem. Making it seamless for you to manage & delightful for your backers to use.

From Discord invites (roles/tier) to automating how businesses can setup their logotype & description once and it automatically propagating across your README (PR/SVG) to sites/docs (SDK). Or how about early access to new features, i.e invite to private repositories? Sponsored posts? Just to mention a few ideas in our pipeline.

Our first built-in benefit is Posts & Newsletters. Enabling a vital communication channel to an audience you own & can reach fully - regardless of which benefits you offer today or tomorrow.

### Posts & Newsletters

![image.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-QKge9Wh9vpdhZRIPLnsMWFesg8SPEY.png)

It's a bit meta, but you're reading a Polar post right now 😎 It's written in markdown, I previewed it easily both on the web & email and I can share it publicly or to paid subscribers.

Or how about a hybrid? This is a public post, but the below is a section reserved for paid subscribers. You see that by the upgrade module below (don't worry - I only hid "1337" in there :-)

<Paywall>1337</Paywall>

We love to write & share code too, so of course we support syntax highlighting in Polar Posts.

\`\`\`python
def hello_world():
    print("Hello world from a Polar Post")

if __name__ == "__main__":
    hello_world()
\`\`\`

I can embed Youtube videos, images, links or even GitHub issues you can fund using Polar issue funding & rewards. 

<embed src="https://github.com/polarsource/polar/issues/897"></embed>

We've battled with the email gods to make all of this a delightful experience over email too. I can easily choose to share this post over the web only or also email it to all my subscribers (newsletter).

Now might be a good time to promote subscribing to our own Polar Posts in the future. So let me embed that nudge easily below.

<SubscribeNow />

We're working on polls and other embeddables too. We can't wait to hear what you think & how we can improve posts for your initiatives!

### API & SDK

You get a personal page on Polar that you can easily promote Posts, Subscriptions & Issue Funding from Day 1: e.g \`polar.sh/polarsource\`. 

We don't think it makes any sense to offer customization abilities to our audience; setting up custom color hex codes, templates etc like other creator platforms. Instead, we're building everything on our public API & offering SDKs (JS first - beta). Since we believe you'd rather integrate it directly on your site, docs and/or services.

Our goal is that the developer page, e.g \`polar.sh/polarsource\`, should be a living example of an API/SDK integration that you can cherry-pick components from. We'd love to hear from you and your use case and work together to ensure we support it - [join our Discord](https://discord.gg/AVgbMhTtBq) to chat about it.

In the meantime, don't hesitate to checkout our:
- [Public Polar API](https://api.polar.sh/redoc)
- [JS SDK](https://github.com/polarsource/polar/releases/tag/jssdk%2Fv0.2.0)

*It's in early development and we'd love your feedback. We are mindful to maintain backward compatibility, but cannot guarantee it at this stage.*

### Pricing

We're incredibly excited to share that we're updating our pricing with this launch. In order to drive even more capital to open source developers.

Moving forward, our pricing is:
- No fixed costs
- 5% + payment & payout fees (Stripe) instead of our former 10% + payment & payout fees.
- *We'll also cover Stripe fees from our 5% until March 31st, 2024*.

Let's go 🚀

### $30K in 2024 from Team Polar

Finally, we're happy to share that we're going to invest $30K of our own to subscribe to open source developers throughout 2024. So don't hesitate to ping @polar_sh on Twitter with your posts to share it with us and we might subscribe :-)

How is this funded?
1. Birk lost it in 2023 and pledged $30K personally and has $20K left to spend.
2. Polar supports businesses to setup open source allowances for team members (invite-only for now). Polar has an employee benefit of each engineer getting $200/month. We're 4 people so that's $800/month or $9,600/year. *We're rounding up the rest :-)*

<hr />
Phew. That's all. This is our biggest update since launching Polar and a big step towards our long-term vision of building a platform for developers to get more funding to even building independent businesses around their initiatives. 

As always, don't hesitate to share your feedback, thoughts or requests on [GitHub](https://github.com/polarsource/polar) or chat with us directly on [Discord](https://discord.gg/AVgbMhTtBq). We're here to serve fellow developers!

All our best,  
Birk, Gustav, Francois & Emil @ Polar`

test('polar', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: polarPost,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('ads-embed', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `
        
<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><picture><img src="https://polar.sh/embed/ad?id=63f3a3cc-54ae-45e9-987a-7174364d234e" alt="Click me!!!!!" height="100" width="100" /></picture></a>
<a href="https://polar.sh/zegl"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/ad?id=94c1676c-db08-4489-b4b4-e25beadf2542&dark=1"><img src="https://polar.sh/embed/ad?id=94c1676c-db08-4489-b4b4-e25beadf2542" alt="Hello world!" height="100" width="100" /></picture></a>

        `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('anchors', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

<p id="top">
[Go to end](#end)
Here we go!
</p>


## End

<a href="#top">Go to top</a>
  
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('XSS', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

<p>
hello
</p>

<p onload="alert(1)">
what
</p>
    
<table>
    <thead>
        <tr><th>TH</th></tr>
    </thead>
    <tbody onload="alert(2)">
        <tr onload="alert(3)"><td onload="alert(4)">TD</td></tr>
        <tr><td><p onload="alert(1)"><img src="not-sanitized" onclick="xxx" /> <a href="javascript:alert(1)">clickme</a> <span onclick="xxx">clickmep</span></p></td><td onclick="x">TD</td></tr>
    </tbody>
</table>
  
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('table', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

| left  | center | right |
| ----- |:------:|----:|
| a | b | c |
| a | b | c |
| a | b | c |


<table>
    <thead>
        <tr><th>TH</th></tr>
    </thead>
    <tbody>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
      <tr><td>TD</td></tr>
    </tbody>
</table>
        
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('paywall', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

prepaywall

<Paywall>here is the content! <strong>wow!</strong></Paywall>

<Paywall>plain content</Paywall>

<Paywall><img src="https://polar.sh/logo.png" /></Paywall>

<!-- Empty paywall contents! Should trigger upsell block! -->
<Paywall></Paywall>

postpaywall
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})

test('code', () => {
  const { container } = render(
    <TestRenderer
      article={{
        ...article,
        body: `

\`\`\`go
func main() {
}
\`\`\`
  `,
      }}
    />,
  )
  expect(container).toMatchSnapshot()
})
