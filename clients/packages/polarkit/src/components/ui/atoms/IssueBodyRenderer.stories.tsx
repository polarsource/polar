import type { Meta, StoryObj } from '@storybook/react'
import { IssueBodyRenderer } from '.'

const meta: Meta<typeof IssueBodyRenderer> = {
  title: 'Atoms/IssueBodyRenderer',
  component: IssueBodyRenderer,
}

export default meta

type Story = StoryObj<typeof IssueBodyRenderer>

export const Default: Story = {
  args: {
    html: `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit,
    sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
    nisi ut aliquip ex ea commodo consequat. <strong>Duis aute irure dolor</strong> in
    reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
    deserunt mollit anim id est laborum.</p>`,
  },
}

export const GitHubIssue: Story = {
  args: {
    html: `<h2 dir="auto">This is a heading</h2>
          <ul dir="auto">
          <li>This is easy...</li>
          <li>...for now!</li>
          </ul>
          <p dir="auto">Now let's add some <strong>emphasized</strong> <em>content</em> and inline code: <code class="notranslate">$ curl -X GET https://example.com</code></p>
          <h2 dir="auto">To-do list</h2>
          <ul class="contains-task-list">
          <li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox" checked=""> Item 1</li>
          <li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox"> Item 2</li>
          <li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox" checked=""> Item 3</li>
          </ul>
          <h2 dir="auto">References</h2>
          <p dir="auto">We can make a reference to another issue: <a class="issue-link js-issue-link" data-error-text="Failed to load title" data-id="1903016495" data-permission-text="Title is private" data-url="https://github.com/frankie567-test-org-renamed/test-repo-two/issues/6" data-hovercard-type="issue" data-hovercard-url="/frankie567-test-org-renamed/test-repo-two/issues/6/hovercard" href="https://github.com/frankie567-test-org-renamed/test-repo-two/issues/6">#6</a>. But we can also <a href="https://example.com" rel="nofollow">make links</a>.</p>
          <h2 dir="auto">Code block</h2>
          <div class="highlight highlight-source-python" dir="auto"><pre class="notranslate"><span class="pl-k">def</span> <span class="pl-en">add</span>(<span class="pl-s1">a</span>: <span class="pl-s1">int</span>, <span class="pl-s1">b</span>:<span class="pl-s1">int</span>) <span class="pl-c1">-&gt;</span> <span class="pl-s1">int</span>:
              <span class="pl-k">return</span> <span class="pl-s1">a</span> <span class="pl-c1">+</span> <span class="pl-s1">b</span></pre></div>
          <h2 dir="auto">Code embed from repo</h2>
          <p dir="auto"></p><div class="Box Box--condensed my-2">
            <div class="Box-header f6">
              <p class="mb-0 text-bold">
                <a href="https://github.com/frankie567-test-org-renamed/test-repo-two/blob/3934492f58cbf9fd4c4e03a5deffb2b10d801fc9/README.md?plain=1#L1-L3">test-repo-two/README.md</a>
              </p>
              <p class="mb-0 color-fg-muted">
                  Lines 1 to 3
                in
                <a data-pjax="true" class="commit-tease-sha" href="/frankie567-test-org-renamed/test-repo-two/commit/3934492f58cbf9fd4c4e03a5deffb2b10d801fc9">3934492</a>
              </p>
            </div>
            <div itemprop="text" class="Box-body p-0 blob-wrapper blob-wrapper-embedded data">
              <table class="highlight tab-size mb-0 js-file-line-container" data-tab-size="8" data-paste-markdown-skip="">

                  <tbody><tr class="border-0">
                    <td id="L1" class="blob-num border-0 px-3 py-0 color-bg-default" data-line-number="1"></td>
                    <td id="LC1" class="blob-code border-0 px-3 py-0 color-bg-default blob-code-inner js-file-line"> <span class="pl-mh"># <span class="pl-en">test-repo-two</span></span> </td>
                  </tr>

                  <tr class="border-0">
                    <td id="L2" class="blob-num border-0 px-3 py-0 color-bg-default" data-line-number="2"></td>
                    <td id="LC2" class="blob-code border-0 px-3 py-0 color-bg-default blob-code-inner js-file-line">  </td>
                  </tr>

                  <tr class="border-0">
                    <td id="L3" class="blob-num border-0 px-3 py-0 color-bg-default" data-line-number="3"></td>
                    <td id="LC3" class="blob-code border-0 px-3 py-0 color-bg-default blob-code-inner js-file-line"> This is a test README! </td>
                  </tr>
              </tbody></table>
            </div>
          </div>
          <p></p>`,
  },
}
