import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import PromptInput from '../PromptInput.vue'

describe('HelloWorld', () => {
  it('renders properly', () => {
    const wrapper = mount(PromptInput, { props: { msg: 'Hello Vitest' } })
      expect(wrapper.text()).toContain('Send')
  })
})
