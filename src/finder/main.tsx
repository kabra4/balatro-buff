import { render } from 'preact';
import '../styles.css';
import './ui/finder.css';
import { FinderApp } from './ui/FinderApp';

const root = document.getElementById('app');
if (root) render(<FinderApp />, root);
