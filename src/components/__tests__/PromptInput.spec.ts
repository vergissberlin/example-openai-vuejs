import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import PromptInput from '../PromptInput.vue'

describe('PromptInput', () => {
	it('renders an input and a send button', () => {
		const wrapper = mount(PromptInput)

		expect(wrapper.find('input').exists()).toBe(true)
		expect(wrapper.text()).toContain('Send')
	})
})
