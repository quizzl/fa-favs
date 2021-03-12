import { h, render } from 'preact'
import Main from './components/Main'

window.addEventListener('load', e => {
	render(<Main />, document.getElementById('root'));
});