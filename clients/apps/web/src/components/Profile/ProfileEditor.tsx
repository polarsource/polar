import { useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ProfileSectionEditor, Section } from './ProfileSectionEditor'

export const ProfileEditor = () => {
  const [selectedSection, setSelectedSection] = useState<Section>()

  /* const hasNative =
    document &&
    (document.elementsFromPoint || 'msElementsFromPoint' in document)

  function getDropTargetElementsAtPoint(
    x: number,
    y: number,
    dropTargets: HTMLElement[],
  ) {
    return dropTargets.filter((t) => {
      const rect = t.getBoundingClientRect()
      return (
        x >= rect.left && x <= rect.right && y <= rect.bottom && y >= rect.top
      )
    })
  }

  // use custom function only if elementsFromPoint is not supported
  const backendOptions = {
    getDropTargetElementsAtPoint: !hasNative && getDropTargetElementsAtPoint,
  }
 */

  return (
    <div className="flex flex-row p-8">
      <DndProvider backend={HTML5Backend} options={{}}>
        <ProfileSectionEditor
          sections={[
            {
              id: 1,
              text: 'Posts',
            },
            {
              id: 2,
              text: 'Subscription Tiers',
            },
            {
              id: 3,
              text: 'Repositories',
            },
            {
              id: 4,
              text: 'Issues',
            },
          ]}
        />
      </DndProvider>
      <div></div>
    </div>
  )
}
