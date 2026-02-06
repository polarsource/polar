import Button from '@polar-sh/ui/components/atoms/Button'
import { Well } from '../Shared/Well'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export interface EventCreationGuideModalProps {
  hide: () => void
}

export const EventCreationGuideModal = ({
  hide,
}: EventCreationGuideModalProps) => {
  return (
    <SyntaxHighlighterProvider>
      <div className="flex flex-col gap-4 p-8">
        <h1 className="text-2xl">Event Ingestion</h1>
        <p>Events can only be created through the Spaire Ingestion API.</p>
        <Well className="dark:bg-polar-900 rounded-lg bg-gray-100 p-4 text-sm">
          <SyntaxHighlighterClient
            lang="typescript"
            code={`import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  accessToken: process.env["SPAIRE_ACCESS_TOKEN"] ?? "",
});

const result = await spaire.events.ingest({
  events: [
    {
      name: "<value>",
      customerId: "<value>",
      metadata: {
        myCustomProperty: "value",
      },
    },
  ],
});`}
          />
        </Well>
        <Button className="self-start" onClick={hide} variant="secondary">
          Close
        </Button>
      </div>
    </SyntaxHighlighterProvider>
  )
}
