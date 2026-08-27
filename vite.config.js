import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/My-Project/' : '/',
  plugins: [
    react(),
    {
      name: 'errandgo-no-startup-splash',
      transform(code, id) {
        if (!id.endsWith('/src/main.jsx')) return null;
        const withoutSplashState = code.replace(
          'const[screen,setScreen]=useState(\'home\'),[menu,setMenu]=useState(false),[selected,setSelected]=useState(null),[modal,setModal]=useState(false),[auth,setAuth]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[tasks,setTasks]=useState(demoTasks),[search,setSearch]=useState(\'\'),[toast,setToast]=useState(\'\'),[notifications,setNotifications]=useState([]),[wallet,setWallet]=useState(null),[loading,setLoading]=useState(true);',
          'const[screen,setScreen]=useState(\'home\'),[menu,setMenu]=useState(false),[selected,setSelected]=useState(null),[modal,setModal]=useState(false),[auth,setAuth]=useState(false),[user,setUser]=useState(null),[profile,setProfile]=useState(null),[tasks,setTasks]=useState(demoTasks),[search,setSearch]=useState(\'\'),[toast,setToast]=useState(\'\'),[notifications,setNotifications]=useState([]),[wallet,setWallet]=useState(null),[loading,setLoading]=useState(false);'
        );
        const withoutSplashRender = withoutSplashState.replace(
          /\n\s*if\(loading\)return <div className="stage"><div className="appShell"><div className="loading"><RefreshCw className="spin"\/> Loading ErrandGo…<\/div><\/div><\/div>;?/,
          ''
        );
        return { code: withoutSplashRender, map: null };
      }
    }
  ],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
