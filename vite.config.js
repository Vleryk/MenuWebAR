import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
//import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react()//,
    //basicSsl()
  ]//,
  //server: {
  //  host: true 
})

//sacar comentarios para usar host para el celular, obvio xd.
// si no funciona, un npm install no hace daño