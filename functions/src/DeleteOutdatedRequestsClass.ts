import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import {getServerTimestamp} from "./Utility";
import DataSnapshot = admin.database.DataSnapshot;

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export default class DeleteOutdatedRequestsClass {

    private static getPromises(tabRequest: DataSnapshot, timestampServer: number): Array<Promise<any>> {
        const promisesResult = [];
        tabRequest.forEach(request => {
            if (timestampServer > Number(request.child('timestamp').val()) + 60 * 1000) {
                promisesResult.push(request.ref.remove());
            }
            return true;
        });
        return promisesResult;
    }

    public static deleteOutdatedRequestsCloudFunction: HttpsFunction = functions.https.onRequest(async (req, res) => {
            try {
                // Get the timestamp from the server
                const serverTimestamp = await getServerTimestamp();

                // Liste toutes les requêtes rangées par timestamp
                const listRequests = await db.ref('/requests/').once('value');

                // Parcourt de la liste des requêtes pour savoir celles qui sont à supprimer
                const listPromisesRequestToDelete = DeleteOutdatedRequestsClass.getPromises(listRequests, serverTimestamp);

                Promise.all(listPromisesRequestToDelete)
                    .then(value => {
                        console.log('Tout s\'est bien passé');
                        res.status(200).send('OK');
                    })
                    .catch(reason => res.status(303).send(reason));
            } catch (error) {
                console.error(error);
                res.status(500).send('FAIL');
            }
        }
    );
}
