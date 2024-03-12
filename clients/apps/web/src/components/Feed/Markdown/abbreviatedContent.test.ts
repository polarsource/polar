import { abbreviatedContent, getReferences } from './BrowserRender'

describe('abbreviatedContent', () => {
  test('short', () => {
    const t = 'Hello World'
    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }).body,
    ).toBe('Hello World')
  })

  test('tinygo', () => {
    const t = `I recently bought a [Pimoroni Cosmic Unicorn](https://shop.pimoroni.com/products/space-unicorns?variant=40842626596947), it's a 32x32 RGB LED display with a Raspberry Pi Pico W attached to it, plus some extras such as buttons, a speaker, and connections for driving it all via a a battery.

![image.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-zH42z7UFMZijmbncu1HqGUww8V02tC.png)

The Cosmic Unicorn comes with drivers and APIs for C/C++ and MicroPython for controlling the display, they both work great. My only annoyance is that the C/C++ driver is written in C++, and MicroPython doesn't have the best performance characteristics. So, I decided to try to build a driver for the Cosmic Unicorn in [TinyGo](https://tinygo.org).`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }).body,
    ).toBe(
      `I recently bought a [Pimoroni Cosmic Unicorn](https://shop.pimoroni.com/products/space-unicorns?variant=40842626596947), it's a 32x32 RGB LED display with a Raspberry Pi Pico W attached to it, plus some extras such as buttons, a speaker, and connections for driving it all via a a battery.

![image.png](https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-zH42z7UFMZijmbncu1HqGUww8V02tC.png)`,
    )
  })

  test('lorem', () => {
    const t = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam mollis hendrerit sapien id viverra.

Sed diam augue, mattis in magna in, condimentum iaculis est. Integer tincidunt, magna quis pulvinar porta, massa tellus efficitur tortor, vel suscipit eros elit condimentum quam. Cras interdum justo vitae lobortis varius. Sed ac tortor vestibulum, maximus nisl sit amet, convallis tellus.

Curabitur lorem neque, rutrum non velit quis, consequat maximus quam. Suspendisse laoreet turpis sit amet enim congue suscipit. Curabitur odio mi, iaculis eget massa vitae, fringilla bibendum turpis. Nam egestas tortor neque, vitae finibus ex venenatis nec. Nam feugiat convallis erat, et volutpat odio venenatis ac. Nunc facilisis eget metus sed pellentesque. Nulla fermentum, dui quis cursus molestie, ante purus tristique est, at placerat dui risus vel enim.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.
    
Mauris at libero purus. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Integer finibus fringilla orci, vitae dignissim sem blandit id. Nulla placerat ligula et bibendum euismod. In sapien erat, consequat in porttitor in, hendrerit sit amet nisl. Fusce bibendum est at bibendum eleifend. In hac habitasse platea dictumst. Mauris eleifend elementum dolor id rhoncus.
    
Aenean et enim congue, hendrerit magna quis, placerat erat. Nam lacus sem, rutrum malesuada est id, commodo viverra elit. Donec auctor, nunc in vulputate varius, lorem mi porttitor metus, ut eleifend sapien dui sed risus. Mauris sagittis tempor diam, vel tincidunt odio sollicitudin vitae. Sed hendrerit lectus convallis quam elementum, viverra fermentum dui ultricies. Fusce eu elit in magna posuere convallis. Mauris sodales tincidunt ipsum quis hendrerit. Pellentesque et neque laoreet est consectetur euismod eget id justo. Vivamus commodo eleifend nunc, at pharetra libero volutpat vel.`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }).body,
    ).toBe(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam mollis hendrerit sapien id viverra.

Sed diam augue, mattis in magna in, condimentum iaculis est. Integer tincidunt, magna quis pulvinar porta, massa tellus efficitur tortor, vel suscipit eros elit condimentum quam. Cras interdum justo vitae lobortis varius. Sed ac tortor vestibulum, maximus nisl sit amet, convallis tellus.`,
    )
  })

  test('custom-<hr>', () => {
    const t = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam mollis hendrerit sapien id viverra.

Sed diam augue, mattis in magna in, condimentum iaculis est. Integer tincidunt, magna quis pulvinar porta, massa tellus efficitur tortor, vel suscipit eros elit condimentum quam. Cras interdum justo vitae lobortis varius. Sed ac tortor vestibulum, maximus nisl sit amet, convallis tellus.

Curabitur lorem neque, rutrum non velit quis, consequat maximus quam. Suspendisse laoreet turpis sit amet enim congue suscipit. Curabitur odio mi, iaculis eget massa vitae, fringilla bibendum turpis. Nam egestas tortor neque, vitae finibus ex venenatis nec. Nam feugiat convallis erat, et volutpat odio venenatis ac. Nunc facilisis eget metus sed pellentesque. Nulla fermentum, dui quis cursus molestie, ante purus tristique est, at placerat dui risus vel enim.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

<hr>

Mauris at libero purus. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Integer finibus fringilla orci, vitae dignissim sem blandit id. Nulla placerat ligula et bibendum euismod. In sapien erat, consequat in porttitor in, hendrerit sit amet nisl. Fusce bibendum est at bibendum eleifend. In hac habitasse platea dictumst. Mauris eleifend elementum dolor id rhoncus.

Aenean et enim congue, hendrerit magna quis, placerat erat. Nam lacus sem, rutrum malesuada est id, commodo viverra elit. Donec auctor, nunc in vulputate varius, lorem mi porttitor metus, ut eleifend sapien dui sed risus. Mauris sagittis tempor diam, vel tincidunt odio sollicitudin vitae. Sed hendrerit lectus convallis quam elementum, viverra fermentum dui ultricies. Fusce eu elit in magna posuere convallis. Mauris sodales tincidunt ipsum quis hendrerit. Pellentesque et neque laoreet est consectetur euismod eget id justo. Vivamus commodo eleifend nunc, at pharetra libero volutpat vel.`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }).body,
    ).toBe(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam mollis hendrerit sapien id viverra.

Sed diam augue, mattis in magna in, condimentum iaculis est. Integer tincidunt, magna quis pulvinar porta, massa tellus efficitur tortor, vel suscipit eros elit condimentum quam. Cras interdum justo vitae lobortis varius. Sed ac tortor vestibulum, maximus nisl sit amet, convallis tellus.

Curabitur lorem neque, rutrum non velit quis, consequat maximus quam. Suspendisse laoreet turpis sit amet enim congue suscipit. Curabitur odio mi, iaculis eget massa vitae, fringilla bibendum turpis. Nam egestas tortor neque, vitae finibus ex venenatis nec. Nam feugiat convallis erat, et volutpat odio venenatis ac. Nunc facilisis eget metus sed pellentesque. Nulla fermentum, dui quis cursus molestie, ante purus tristique est, at placerat dui risus vel enim.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.`,
    )
  })

  test('custom-<hr>-early', () => {
    const t = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.

---

Aliquam mollis hendrerit sapien id viverra.`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }),
    ).toStrictEqual({
      body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      manualBoundary: true,
      matchedBoundary: '---\n',
    })
  })

  test('custom-<hr>-early-multi-dash', () => {
    const t = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.

------

Aliquam mollis hendrerit sapien id viverra.`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: false }),
    ).toStrictEqual({
      body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      manualBoundary: true,
      matchedBoundary: '------\n',
    })
  })

  test('custom-<hr>-early-include', () => {
    const t = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.

---

Aliquam mollis hendrerit sapien id viverra.`

    expect(
      abbreviatedContent({ body: t, includeBoundaryInBody: true }).body,
    ).toBe(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit.

---
`,
    )
  })

  test('references', () => {
    const t = `
It was a [hobbit-hole][1], and that means comfort.

---

Below the boundary!

[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"
    `

    expect(
      abbreviatedContent({
        body: t,
        includeBoundaryInBody: false,
        includeRefs: true,
      }).body,
    ).toStrictEqual(`
It was a [hobbit-hole][1], and that means comfort.

[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"`)
  })
})

describe('getReferences', () => {
  test('ref', () => {
    const t = `
It was a [hobbit-hole][1], and that means comfort.

[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"

content

[named-ref]: hello!!

[^named-footnote]: footnote :-)

more content
`
    expect(getReferences(t)).toStrictEqual([
      `[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"`,
      '[named-ref]: hello!!',
    ])
  })

  test('none', () => {
    const t = `
It was a [hobbit-hole][1], and that means comfort.`
    expect(getReferences(t)).toStrictEqual([])
  })
})
