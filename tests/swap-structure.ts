import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import { SwapStructure } from "../target/types/swap_structure";
import fetch from "cross-fetch";
import bs58 from "bs58";

describe("swap-structure", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const WRAPPED_SOL = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );
  const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  //make sure to handle raw value if going the other way (usdc to sol), where usdc has six decimals
  const getSwapTransactions = async (
    userPublicKey: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    inputToGiveUp: number
  ) => {
    const connection = new Connection("https://ssc-dao.genesysgo.net");
    const { data } = await (
      await fetch(
        `https://quote-api.jup.ag/v1/quote?inputMint=${inputMint.toString()}&outputMint=${outputMint.toString()}&amount=${inputToGiveUp}&slippage=0.5`
      )
    ).json();
    //console.log(data);

    const transactions = await (
      await fetch("https://quote-api.jup.ag/v1/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: data[0], //pulls the best route from routes above
          userPublicKey, //wallet used for the swap (must sign)
          wrapUnwrapSOL: true, //leave true
        }),
      })
    ).json();
    const { setupTransaction, swapTransaction, cleanupTransaction } =
      transactions;
    return { setupTransaction, swapTransaction, cleanupTransaction };
  };

  it("jupiter test", async () => {
    const connection = new Connection("https://ssc-dao.genesysgo.net");

    let formattedTxs = await getSwapTransactions(
      provider.wallet.publicKey,
      WRAPPED_SOL,
      USDC,
      web3.LAMPORTS_PER_SOL * 0.0001
    );

    for (let serializedTransaction of [
      formattedTxs.setupTransaction,
      formattedTxs.swapTransaction,
      formattedTxs.cleanupTransaction,
    ].filter(Boolean)) {
      // get transaction object from serialized transaction
      const transaction = Transaction.from(
        Buffer.from(serializedTransaction, "base64")
      );
      provider.wallet.signTransaction(transaction);
      const txid = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: true,
        }
      );

      await connection.confirmTransaction(txid);
      console.log(`https://solscan.io/tx/${txid}`);
    }
  });
});
