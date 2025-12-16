const { RuleTester } = require('eslint')
const rule = require('./no-jsx-logical-and')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
})

ruleTester.run('no-jsx-logical-and', rule, {
  valid: [
    {
      code: `
        const Component = () => (
          <div>{isVisible ? <Text>Hello</Text> : null}</div>
        );
      `,
    },
    {
      code: `
        const Component = () => (
          <div>{count > 0 ? <Text>Items</Text> : null}</div>
        );
      `,
    },
    {
      code: `
        const Component = () => (
          <div>{isLoading ? <Spinner /> : <Content />}</div>
        );
      `,
    },
    {
      code: `
        // && outside of JSX is fine
        const result = foo && bar;
      `,
    },
    {
      code: `
        // && with non-JSX right side in JSX is fine
        const Component = () => (
          <div>{foo && "text"}</div>
        );
      `,
    },
    {
      code: `
        // Nested ternaries are fine
        const Component = () => (
          <div>{a ? (b ? <X /> : null) : null}</div>
        );
      `,
    },
  ],

  invalid: [
    {
      code: `
        const Component = () => (
          <div>{isVisible && <Text>Hello</Text>}</div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }],
    },
    {
      code: `
        const Component = () => (
          <div>{count && <Text>Items</Text>}</div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }],
    },
    {
      code: `
        const Component = () => (
          <div>{user?.name && <Profile />}</div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }],
    },
    {
      code: `
        const Component = () => (
          <div>{items.length > 0 && <List />}</div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }],
    },
    {
      code: `
        const Component = () => (
          <div>{isVisible && <><Text>A</Text><Text>B</Text></>}</div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }],
    },
    {
      code: `
        const Component = () => (
          <div>
            {foo && <A />}
            {bar && <B />}
          </div>
        );
      `,
      errors: [{ messageId: 'noLogicalAnd' }, { messageId: 'noLogicalAnd' }],
    },
  ],
})
