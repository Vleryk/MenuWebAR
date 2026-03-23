import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
//import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react()//,
    //basicSsl()
  ]
  //server: {
  //  host: true // Esto es lo que permite que tu celular se conecte
})

//sacar comentarios para usar, necesario para AR en celus.