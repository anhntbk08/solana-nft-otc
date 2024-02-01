import * as anchor from "@project-serum/anchor";
import { Program, Wallet } from "@project-serum/anchor";
import { MetaplexMinting } from "../target/types/metaplex_minting";
// import { MetaplexMinting } from '../target/types/metaplex_anchor_nft'
import {
    TOKEN_PROGRAM_ID,
    createInitializeAccountInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    createInitializeMintInstruction,
    createAccount,
    MINT_SIZE,
    setAuthority
} from '@solana/spl-token' // IGNORE THESE ERRORS IF ANY
const { SystemProgram } = anchor.web3;
const fs = require('fs');

const MINT_PROGRAM_PUBLICKEY = "8fjEtXmvFgQgWXkD24J5RHow6gxUJnocA9TpXNFPDYfE";

// TODO, custome to create as many as need nft
async function generateData(nft1Authority, nft2Authority) {
    const provider = anchor.AnchorProvider.env();
    const wallet = provider.wallet as Wallet;

    anchor.setProvider(provider);
    const program = anchor.workspace.MetaplexMinting as Program<MetaplexMinting>

    // program.programId = new anchor.web3.PublicKey(MINT_PROGRAM_PUBLICKEY);
    let creator = anchor.web3.Keypair.generate();

    // metaplex address on devnet
    const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );
    const lamports: number =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            MINT_SIZE
        );
    const getMetadata = async (
        mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID
            )
        )[0];
    };

    const getMasterEdition = async (
        mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                    Buffer.from("edition"),
                ],
                TOKEN_METADATA_PROGRAM_ID
            )
        )[0];
    };

    // contain the spl token data, metaplex wraps over this token
    let mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();

    let NftTokenAccount = await getAssociatedTokenAddress(
        mintKey.publicKey,
        wallet.publicKey
    );
    console.log("NFT Account: ", NftTokenAccount.toBase58());

    let mint_tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mintKey.publicKey,
            space: MINT_SIZE,
            programId: TOKEN_PROGRAM_ID,
            lamports,
        }),
        createInitializeMintInstruction(
            mintKey.publicKey,
            0,
            wallet.publicKey,
            wallet.publicKey
        ),
        createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            NftTokenAccount,
            wallet.publicKey,
            mintKey.publicKey
        )
    );

    let res = await program.provider.sendAndConfirm(mint_tx, [mintKey]);
    // console.log(
    //     await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    // );

    let metadataAddress = await getMetadata(mintKey.publicKey);
    let masterEdition = await getMasterEdition(mintKey.publicKey);

    let tx = await program.methods.mintNft(
        mintKey.publicKey,
        "https://arweave.net/y5e5DJsiwH0s_ayfMwYk-SnrZtVZzHLQDSTZ5dNRUHA",
        "NFT swap sell",
    )
        .accounts({
            mintAuthority: wallet.publicKey,
            mint: mintKey.publicKey,
            tokenAccount: NftTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            metadata: metadataAddress,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            masterEdition: masterEdition,
        },
        )
        .rpc();
    let result = [
        JSON.parse(JSON.stringify({
            "nft_account": NftTokenAccount.toBase58(),
            "nft_publickey": "6ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9",
            "mint_secret_key": mintKey.secretKey.toString(),
            "account": res,
            "mint_key": mintKey.publicKey.toBase58(),
            "user": "7DvRvZGR19SUrsYnA47aeBTKMCUkdij2jA9uk6aXn6L7",
            "metadata_address": metadataAddress.toBase58(),
            "master_edition": masterEdition.toBase58(),
            "tx_signature": tx,
        }))
    ];
    mintKey = anchor.web3.Keypair.generate();

    NftTokenAccount = await getAssociatedTokenAddress(
        mintKey.publicKey,
        wallet.publicKey
    );

    mint_tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mintKey.publicKey,
            space: MINT_SIZE,
            programId: TOKEN_PROGRAM_ID,
            lamports,
        }),
        createInitializeMintInstruction(
            mintKey.publicKey,
            0,
            wallet.publicKey,
            wallet.publicKey
        ),
        createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            NftTokenAccount,
            wallet.publicKey,
            mintKey.publicKey
        )
    );

    await program.provider.sendAndConfirm(mint_tx, [mintKey]);

    metadataAddress = await getMetadata(mintKey.publicKey);
    masterEdition = await getMasterEdition(mintKey.publicKey);

    tx = await program.methods.mintNft(
        mintKey.publicKey,
        "https://arweave.net/y5e5DJsiwH0s_ayfMwYk-SnrZtVZzHLQDSTZ5dNRUHA",
        "NFT to swap buy",
    )
        .accounts({
            mintAuthority: wallet.publicKey,
            mint: mintKey.publicKey,
            tokenAccount: NftTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            metadata: metadataAddress,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            masterEdition: masterEdition,
        },
        )
        .rpc();
    console.log("Your transaction signature", tx);

    return [
        ...result,
        {
            "nft_account": NftTokenAccount.toBase58(),
            "nft_publickey": "6ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9",
            "mint_secret_key": mintKey.secretKey.toString(),
            "account": res,
            "mint_key": mintKey.publicKey.toBase58(),
            "user": "7DvRvZGR19SUrsYnA47aeBTKMCUkdij2jA9uk6aXn6L7",
            "metadata_address": metadataAddress.toBase58(),
            "master_edition": masterEdition.toBase58(),
            "tx_signature": tx,
    }];
};

export default {
    generateData,
    delay:  ms => new Promise(resolve => setTimeout(resolve, ms)),
};
