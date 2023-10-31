import type { Meta, StoryObj } from '@storybook/react'

import { SubscriptionsChart } from '@/components/Subscriptions/SubscriptionsChart'
import { getCentsInDollarString } from 'polarkit/money'

const meta: Meta<typeof SubscriptionsChart> = {
  title: 'Organisms/SubscriptionsChart',
  component: SubscriptionsChart,
}

export default meta

type Story = StoryObj<typeof SubscriptionsChart>

export const Default: Story = {
  render: () => {
    return (
      <SubscriptionsChart
        y="mrr"
        axisYOptions={{
          ticks: 'month',
          label: null,
          tickFormat: (t, i) =>
            `$${getCentsInDollarString(t, undefined, true)}`,
        }}
        data={sampleData.map((d) => ({
          ...d,
          parsedStartDate: new Date(d.start_date),
        }))}
      />
    )
  },
}

const sampleData = [
  {
    start_date: '2022-10-01',
    end_date: '2022-11-01',
    subscribers: 5,
    mrr: 50,
    cumulative: 50,
  },
  {
    start_date: '2022-11-01',
    end_date: '2022-12-01',
    subscribers: 150,
    mrr: 1500,
    cumulative: 150,
  },
  {
    start_date: '2022-12-01',
    end_date: '2023-01-01',
    subscribers: 22,
    mrr: 800,
    cumulative: 370,
  },
  {
    start_date: '2023-01-01',
    end_date: '2023-02-01',
    subscribers: 30,
    mrr: 290,
    cumulative: 670,
  },
  {
    start_date: '2023-02-01',
    end_date: '2023-03-01',
    subscribers: 40,
    mrr: 643,
    cumulative: 1070,
  },
  {
    start_date: '2023-03-01',
    end_date: '2023-04-01',
    subscribers: 23,
    mrr: 230,
    cumulative: 1300,
  },
  {
    start_date: '2023-04-01',
    end_date: '2023-05-01',
    subscribers: 18,
    mrr: 180,
    cumulative: 2170,
  },
  {
    start_date: '2023-05-01',
    end_date: '2023-06-01',
    subscribers: 21,
    mrr: 210,
    cumulative: 2870,
  },
  {
    start_date: '2023-06-01',
    end_date: '2023-07-01',
    subscribers: 36,
    mrr: 360,
    cumulative: 3670,
  },
  {
    start_date: '2023-07-01',
    end_date: '2023-08-01',
    subscribers: 118,
    mrr: 1180,
    cumulative: 4570,
  },
  {
    start_date: '2023-08-01',
    end_date: '2023-09-01',
    subscribers: 72,
    mrr: 720,
    cumulative: 5570,
  },
  {
    start_date: '2023-09-01',
    end_date: '2023-10-01',
    subscribers: 55,
    mrr: 550,
    cumulative: 6670,
  },
  {
    start_date: '2023-10-01',
    end_date: '2023-11-01',
    subscribers: 43,
    mrr: 430,
    cumulative: 7870,
  },
]
