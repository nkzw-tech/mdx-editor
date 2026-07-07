import { AdmonitionKind } from 'lexical'
import React from 'react'
import { EditorInFocus } from '../../core/index.js'
import type { DirectiveNode } from '../../directives/DirectiveNode.js'
import { ConditionalContents, Separator } from '../primitives/toolbar.js'
import { BlockTypeSelect } from './BlockTypeSelect.js'
import { BoldItalicUnderlineToggles, StrikeThroughSupSubToggles } from './BoldItalicUnderlineToggles.js'
import { ChangeAdmonitionType } from './ChangeAdmonitionType.js'
import { ChangeCodeMirrorLanguage } from './ChangeCodeMirrorLanguage.js'
import { CodeToggle } from './CodeToggle.js'
import { DiffSourceToggleWrapper } from './DiffSourceToggleWrapper.js'
import { InsertAdmonition } from './InsertAdmonition.js'
import { InsertCodeBlock } from './InsertCodeBlock.js'
import { InsertFrontmatter } from './InsertFrontmatter.js'
import { InsertImage } from './InsertImage.js'
import { InsertTable } from './InsertTable.js'
import { InsertThematicBreak } from './InsertThematicBreak.js'
import { ListsToggle } from './ListsToggle.js'
import { UndoRedo } from './UndoRedo.js'
import { CreateLink } from './CreateLink.js'
import { HighlightToggle } from './HighlightToggle.js'

function whenInAdmonition(editorInFocus: EditorInFocus | null) {
  const node = editorInFocus?.rootNode
  if (!node || node.getType() !== 'directive') {
    return false
  }

  return ['note', 'tip', 'danger', 'info', 'caution'].includes((node as DirectiveNode).getMdastNode().name as AdmonitionKind)
}

/**
 * A toolbar component that includes all toolbar components.
 * Notice that some of the buttons will work only if you have the corresponding plugin enabled, so you should use it only for testing purposes.
 * You'll probably want to create your own toolbar component that includes only the buttons that you need.
 * @group Toolbar Components
 */
export const KitchenSinkToolbar: React.FC = () => {
  return (
    <DiffSourceToggleWrapper>
      <ConditionalContents
        options={[
          { when: (editor) => editor?.editorType === 'codeblock', contents: () => <ChangeCodeMirrorLanguage /> },
          {
            fallback: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <HighlightToggle />
                <Separator />
                <StrikeThroughSupSubToggles />
                <Separator />
                <ListsToggle />
                <Separator />

                <ConditionalContents
                  options={[{ when: whenInAdmonition, contents: () => <ChangeAdmonitionType /> }, { fallback: () => <BlockTypeSelect /> }]}
                />

                <Separator />

                <CreateLink />
                <InsertImage />

                <Separator />

                <InsertTable />
                <InsertThematicBreak />

                <Separator />
                <InsertCodeBlock />

                <ConditionalContents
                  options={[
                    {
                      when: (editorInFocus) => !whenInAdmonition(editorInFocus),
                      contents: () => (
                        <>
                          <Separator />
                          <InsertAdmonition />
                        </>
                      )
                    }
                  ]}
                />

                <Separator />
                <InsertFrontmatter />
              </>
            )
          }
        ]}
      />
    </DiffSourceToggleWrapper>
  )
}
