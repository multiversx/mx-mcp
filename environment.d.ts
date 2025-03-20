declare global {
    namespace NodeJS {
      interface ProcessEnv {
        MVX_WALLET: string;
        MVX_NETWORK: string;
      }
    }
}

export { };
