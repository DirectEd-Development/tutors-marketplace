import {
    Data,
    Lucid,
    Blockfrost,
    getAddressDetails,
    SpendingValidator,
    TxHash,
    Datum,
    UTxO,
    Address,
    AddressDetails,
} from "https://deno.land/x/lucid@0.9.1/mod.ts";

// create a seed.ts file with your seed
import { secretSeed } from "./seed.ts";

// set blockfrost endpoint
const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-Preprod.blockfrost.io/api/v0",
        "preprodkVTexzRSG7nvhxXWegyOulGyNmSJyhx5"
    ),
    "Preprod"
);

// load local stored seed as a wallet into lucid
lucid.selectWalletFromSeed(secretSeed);
const addr: Address = await lucid.wallet.address();
console.log("Wallet Address:", addr);

// Define the plutus script
const vestingScript: SpendingValidator = {
    type: "PlutusV2",
    script: "5903b25903af01000032323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232322225333573466600890000010008a4c2c444646464646464646464646464664a666ae68cdc3800a400024660826608000c01000824940d55ce9baa00100100d33303a00122323303c00300133036303500100b375090002980d8051981918189811800803a980d80419981b00091191981c0018009981918188008031ba848000cc0a80048c8cc94ccd5cd19b870014800048c8cc06cc0680054c07402cc0d800449281aab9d37540020026026002604800260440086601800e00c66016002a6012601092104444a4544003006530083007491386663383065366634393731373033393961333032666133396666326134643638373163376465343130383265363331353664653339336237004c01024101004c011e581ca1deebd26b685e6799218f60e2cad0a80928c4145d12f1bf49aebab500013237526e600048c84dd49b980013002001237326eb800488cdd2a4000660060040024466ae80008c00c0048cd5d000080e00091aba1300200123574460280020120464264646602c00246464a666ae68cdc39aab9d00148000528099baf357426aae78004014dd5000980b180a80098081807801298010009098061805180918089804a980100090991980318029806801119baf300500100253002001213019301700101701623223330050020010043758002400244464666002002008006444a666aae7c0085854ccd5cd18009aba1002130043574200426660060066ae880080040408cc0080052002225333573466e1cd55ce9baa00200110021600f00e001235742600400246ae88c02c0040280248c88dd3998020010009bac00122333004002001003376293111191998008008020019112999aab9f002100415333573460026ae840084cd5d01aba10023330030033574400400226660060066ae8800800400888ccc888cc88ccc0080080040148894ccd55cf80089ba84800054ccd5cd19baf35573a6ae840040144cc008008dd59aab9e3574200226660060060046ae88004894ccd55cf80089ba84800054ccd5cd19baf35573a6ae8400400c4d55cf1aba1001133002002357440026eac008c014004c00c0048d5d0980100091aba23003001235742600400246aae78dd5000911ba8337006eb4008dd6800919111998028018010009bac001222323333001001004003002222253335573e0062002266660080086ae8800c008cc008004d5d0801911ba8337026eb4008dd6800800baf1"
};

const vestingAddress: Address = lucid.utils.validatorToAddress(vestingScript);

// Define the ConsumeDjed data type
const ConsumeDjed = Data.Object({
    amount: Data.BigInt,
    purpose: Data.String,
});

// Define the ConsumeDjedType based on the ConsumeDjed data type
type ConsumeDjedType = Data.Static<typeof ConsumeDjed>;

// Token Policy ID and Name for testtoken
const testTokenPolicyId = "7960d6109271c0b80840e9a77d7b5703ba882c46cea3f4e7191ec92f";
const testTokenName = "4d657368546f6b656e";


async function logAvailableUTxOs() {
    try {
        const walletAddress = await lucid.wallet.address();
        const utxos = await lucid.utxosAt(walletAddress);

        console.log("Available UTxOs in the wallet:");
        console.log(utxos);
    } catch (error) {
        console.error("Error occurred while fetching UTxOs:", error);
    }
}

logAvailableUTxOs();
// Function to find and filter UTxOs with the specified policy ID and token name
async function findUTxOsByPolicyAndName(walletAddress: Address, policyId: string, tokenName: string): Promise<UTxO[]> {
    try {
        const utxos = await lucid.utxosAt(walletAddress);

        // Filter UTxOs that contain the specified token asset with the given policy ID and token name
        const filteredUTxOs = utxos.filter((utxo) => {
            const tokenAsset = utxo.assets[policyId+tokenName];
            return tokenAsset !== undefined;
        });

        return filteredUTxOs;
    } catch (error) {
        console.error("Error occurred while finding UTxOs:", error);
        return [];
    }
}

// Function to swap testtoken for DJED
async function swapTestTokenForDJED(testTokenAmount: bigint) {
    try {
        const walletAddress = await lucid.wallet.address();
        const testTokenUTxOs = await findUTxOsByPolicyAndName(walletAddress, testTokenPolicyId, testTokenName);
        const vestingUtxos = await lucid.utxosAt(vestingAddress);
        const Datum = Data.to(BigInt(42));
       
        

        if (testTokenUTxOs.length === 0) {
            console.log("No UTxOs with testtoken asset found.");
            return;
        }

       


        // Create a new transaction builder
        const txBuilder = lucid.newTx();

        txBuilder.collectFrom(vestingUtxos, Datum);

        // Add the testtoken UTxOs as inputs to the transaction
        txBuilder.collectFrom(testTokenUTxOs);

        // Attach validator
        txBuilder.attachSpendingValidator(vestingScript)

        // Add the output to send DJED to the contract address

        txBuilder.payToAddress(vestingAddress, { ["a1deebd26b685e6799218f60e2cad0a80928c4145d12f1bf49aebab5" + "4d657368546f6b656e"]: testTokenAmount })

        // Complete the transaction
        const tx = await txBuilder.complete();

        // Submit the signed transaction to the network
        const signedTx = await tx.sign().complete();
        const txHash = await signedTx.submit();
        console.log("Transaction submitted. Hash:", txHash);
    } catch (error) {
        console.error("Error occurred while swapping testtoken for DJED:", error);
    }
}

async function swap() {
    // Call the function to swap testtoken for DJED
    const testTokenAmountToSwap = 10; // Test token amount to swap
    await swapTestTokenForDJED(BigInt(testTokenAmountToSwap));
}

swap();
