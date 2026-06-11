import { Text } from '@polar-sh/orbit'
import {
  Example,
  PageHeader,
  Prose,
  PropsTable,
  Section,
  type PropRow,
} from '@/components/docs'
import {
  AreasGridDemo,
  BasicGridDemo,
  PlacementGridDemo,
  ResponsiveGridDemo,
} from './examples'

const basicCode = `<Grid templateColumns="repeat(3, 1fr)" gap="m">
  <Cell>1</Cell>
  <Cell>2</Cell>
  <Cell>3</Cell>
  <Cell>4</Cell>
  <Cell>5</Cell>
  <Cell>6</Cell>
</Grid>`

const responsiveCode = `<Grid
  templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }}
  gap="m"
>
  {items.map((item) => (
    <Cell key={item.id}>{item.label}</Cell>
  ))}
</Grid>`

const areasCode = `<Grid
  templateAreas={'"header header" "sidebar main"'}
  templateColumns="160px 1fr"
  gap="m"
>
  <GridItem area="header">…</GridItem>
  <GridItem area="sidebar">…</GridItem>
  <GridItem area="main">…</GridItem>
</Grid>`

const placementCode = `<Grid templateColumns="repeat(4, 1fr)" gap="m">
  <GridItem colSpan={2}>colSpan 2</GridItem>
  <GridItem colStart={3} colEnd={5} rowSpan={2}>colStart 3, rowSpan 2</GridItem>
  <GridItem>auto</GridItem>
  <GridItem>auto</GridItem>
</Grid>`

const gridProps: PropRow[] = [
  {
    name: 'templateColumns',
    type: 'ResponsiveValue<string>',
    description: "grid-template-columns, e.g. 'repeat(3, 1fr)'.",
  },
  {
    name: 'templateRows',
    type: 'ResponsiveValue<string>',
    description: 'grid-template-rows.',
  },
  {
    name: 'templateAreas',
    type: 'ResponsiveValue<string>',
    description: 'grid-template-areas.',
  },
  {
    name: 'autoFlow',
    type: "ResponsiveValue<'row' | 'column' | 'dense' | …>",
    description: 'grid-auto-flow.',
  },
  {
    name: 'autoColumns',
    type: 'ResponsiveValue<string>',
    description: 'grid-auto-columns.',
  },
  {
    name: 'autoRows',
    type: 'ResponsiveValue<string>',
    description: 'grid-auto-rows.',
  },
  {
    name: 'column',
    type: 'ResponsiveValue<GridPlacement>',
    description: 'grid-column on the grid itself: a line, or <start> / <end>.',
  },
  {
    name: 'row',
    type: 'ResponsiveValue<GridPlacement>',
    description: 'grid-row on the grid itself.',
  },
  {
    name: 'inline',
    type: 'boolean',
    default: 'false',
    description: 'Render as inline-grid instead of grid.',
  },
  {
    name: 'gap',
    type: 'SpacingToken',
    description: 'Inherited from Box. Also rowGap and columnGap.',
  },
  {
    name: '…Box props',
    type: 'BoxStyleProps',
    description:
      'Every other Box prop is inherited: padding, color, border, responsive objects and more.',
  },
]

const gridItemProps: PropRow[] = [
  {
    name: 'colSpan',
    type: "ResponsiveValue<number | 'auto'>",
    description: 'Number of columns to span.',
  },
  {
    name: 'rowSpan',
    type: "ResponsiveValue<number | 'auto'>",
    description: 'Number of rows to span.',
  },
  {
    name: 'colStart',
    type: 'ResponsiveValue<GridLine>',
    description: 'grid-column-start. A line number, auto, or span N.',
  },
  {
    name: 'colEnd',
    type: 'ResponsiveValue<GridLine>',
    description: 'grid-column-end.',
  },
  {
    name: 'rowStart',
    type: 'ResponsiveValue<GridLine>',
    description: 'grid-row-start.',
  },
  {
    name: 'rowEnd',
    type: 'ResponsiveValue<GridLine>',
    description: 'grid-row-end.',
  },
  {
    name: 'area',
    type: 'ResponsiveValue<string>',
    description: 'grid-area, places the item by template area name.',
  },
  {
    name: '…Box props',
    type: 'BoxStyleProps',
    description: 'Every other Box prop is inherited.',
  },
]

export default function GridPage() {
  return (
    <>
      <PageHeader
        title="Grid"
        description="A Box preset for CSS grid. Grid defaults to display grid and re-exposes the grid properties under short, Chakra-style prop names. Every other Box prop, including gap, padding, color and responsive objects, is inherited."
      />

      <Section
        title="Overview"
        description="Use Grid for two-dimensional layouts and GridItem for children that span tracks or are placed explicitly."
      >
        <Prose>
          <Text color="muted">
            Because Grid is a Box, spacing uses tokens through gap, rowGap and
            columnGap, and every prop accepts a responsive object. Track lists
            such as repeat(3, 1fr) stay typed as strings, while line and
            placement values have a constrained grammar.
          </Text>
        </Prose>
      </Section>

      <Section title="Basic grid">
        <Example
          title="Three equal columns"
          description="templateColumns with a token gap."
          code={basicCode}
          align="stretch"
        >
          <BasicGridDemo />
        </Example>
      </Section>

      <Section title="Responsive columns">
        <Example
          description="Pass a responsive object to templateColumns to change the track count per breakpoint."
          code={responsiveCode}
          align="stretch"
        >
          <ResponsiveGridDemo />
        </Example>
      </Section>

      <Section title="Template areas">
        <Example
          description="Name regions with templateAreas and place children with GridItem area."
          code={areasCode}
          align="stretch"
        >
          <AreasGridDemo />
        </Example>
      </Section>

      <Section title="Spans and placement">
        <Example
          description="GridItem covers tracks with colSpan and rowSpan, or places explicitly with colStart, colEnd, rowStart and rowEnd."
          code={placementCode}
          align="stretch"
        >
          <PlacementGridDemo />
        </Example>
      </Section>

      <Section title="Grid props">
        <PropsTable rows={gridProps} />
      </Section>

      <Section title="GridItem props">
        <PropsTable rows={gridItemProps} />
      </Section>
    </>
  )
}
