import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import tunnel from '../src'

describe('tunnelrat', () => {
  it('transports the children of In into Out', () => {
    const t = tunnel()

    const Outlet = () => (
      <ul>
        <t.Out />
      </ul>
    )

    const Inlets = () => (
      <div>
        <t.In>
          <li>One</li>
        </t.In>
      </div>
    )

    const { container } = render(
      <>
        <Outlet />
        <Inlets />
      </>
    )

    expect(container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            One
          </li>
        </ul>
        <div />
      </div>
    `)
  })

  it('can handle multiple children', () => {
    const t = tunnel()

    const Outlet = () => (
      <ul>
        <t.Out />
      </ul>
    )

    const Inlets = () => (
      <div>
        <t.In>
          <li>One</li>
        </t.In>
        <t.In>
          <li>Two</li>
        </t.In>
      </div>
    )

    const { container } = render(
      <>
        <Outlet />
        <Inlets />
      </>
    )

    expect(container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            One
          </li>
          <li>
            Two
          </li>
        </ul>
        <div />
      </div>
    `)
  })

  it('retains the expected order of multiple children after un- and remounts', () => {
    const t = tunnel()

    const Rat = ({ name }: { name: string }) => {
      const [visible, setVisible] = React.useState(true)

      return (
        <div>
          <button onClick={() => setVisible(!visible)}>Toggle {name}</button>
          {visible ? (
            <t.In>
              <li>{name}</li>
            </t.In>
          ) : null}
        </div>
      )
    }

    const Outlet = () => (
      <ul>
        <t.Out />
      </ul>
    )

    const Inlets = () => (
      <div>
        <Rat name="One" />
        <Rat name="Two" />
        <Rat name="Three" />
      </div>
    )

    const { container } = render(
      <>
        <Outlet />
        <Inlets />
      </>
    )

    expect(container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            One
          </li>
          <li>
            Two
          </li>
          <li>
            Three
          </li>
        </ul>
        <div>
          <div>
            <button>
              Toggle 
              One
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Two
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Three
            </button>
          </div>
        </div>
      </div>
    `)

    /* Remove the middle rat */
    fireEvent.click(screen.getByText('Toggle Two'))

    expect(container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            One
          </li>
          <li>
            Three
          </li>
        </ul>
        <div>
          <div>
            <button>
              Toggle 
              One
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Two
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Three
            </button>
          </div>
        </div>
      </div>
    `)

    /* Re-add it */
    fireEvent.click(screen.getByText('Toggle Two'))

    /* The "Two" rat gets re-added, and at the top of the list. */
    expect(container).toMatchInlineSnapshot(`
      <div>
        <ul>
          <li>
            One
          </li>
          <li>
            Two
          </li>
          <li>
            Three
          </li>
        </ul>
        <div>
          <div>
            <button>
              Toggle 
              One
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Two
            </button>
          </div>
          <div>
            <button>
              Toggle 
              Three
            </button>
          </div>
        </div>
      </div>
    `)
  })
})
