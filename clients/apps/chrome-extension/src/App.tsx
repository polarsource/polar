import { useEffect } from 'react'
import './App.css'
import logo from './logo.svg'

function App() {
  useEffect(() => {
    chrome.storage.onChanged.addListener((changes: object, areaName: string) =>
      console.log('STORAGE CHANGES', changes, areaName),
    )
  })

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="Fisk-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  )
}

export default App
