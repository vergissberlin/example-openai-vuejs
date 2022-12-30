import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import ChatInput from '../ChatInput.vue'

describe('HelloWorld', () => {
  it('renders properly', () => {
    const wrapper = mount(ChatInput, { props: { msg: 'Hello Vitest' } })
      expect(wrapper.text()).toContain('Send')
  })
})
