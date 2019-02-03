import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import {daysInMilliseconds, getServerTimestamp, getTokens, sendNotification} from "./Utility";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export default class CheckToNotifyUserClass {

    public static checkAllAnnonceFunction: HttpsFunction = functions.https.onRequest(async (req, res) => {
            try {
                // Get the timestamp from the server
                const serverTimestamp = await getServerTimestamp();

                // Parcourt de la liste des annonces pour voir celles qu'on va relancer
                CheckToNotifyUserClass.getAnnoncesWithoutPhotos(serverTimestamp);

                console.log('Tout s\'est bien passé');
                res.status(200).send('OK');
            } catch (error) {
                console.error(error);
                res.status(500).send('FAIL');
            }
        }
    );

    // On veut pouvoir relancer les utilisateurs qui ne mettent pas de photo dans leurs annonces
    private static getAnnoncesWithoutPhotos(timestampServer: number): void {
        db.ref('/annonces/').once('value')
            .then(datasnapshot => {
                for (const annonceDatasnapshot of datasnapshot.val()) {
                    this.checkDateAndSendNotification(annonceDatasnapshot, timestampServer);
                }
            })
            .catch(reason => console.error(new Error(reason)));
    }

    // Va rechercher la liste des annonces postées sans photos depuis plus de 3 jours
    private static checkDateAndSendNotification(annonceDatasnapshot, timestampServer: number) {
        // Récupération de l'objet Annonce
        const annonce = annonceDatasnapshot.val();

        // Si on a déjà une date de relance c'est elle qu'on va regarder, sinon ça sera la date de publication
        const isDateRelanceDefined = (annonce.dateRelance !== undefined && annonce.dateRelance && annonce.dateRelance > 0);
        const dateAComparer = (isDateRelanceDefined) ? annonce.dateRelance : annonce.datePublication;

        // Si la date à comparer est supérieure à 2 jours
        if ((timestampServer - dateAComparer) > daysInMilliseconds(3)) {

            // Cela fait plus de 2 jours que l'annonce a été publiée... je regarde si l'annonce a des photos
            if (!annonce.photos || annonce.photos === undefined || annonce.photos.size === 0) {
                this.retrieveTokensAndSendNotification(annonce, timestampServer);
            }
        }
    }

    private static retrieveTokensAndSendNotification(annonce, timestampServer: number) {
        // L'annonce n'a pas de photos... je vais rechercher le token de l'utilisateur
        const uuidUser = annonce.utilisateur.uuid;
        getTokens(new Array(uuidUser))
            .then(arrayTokens => {
                this.sendNotification(uuidUser, annonce, timestampServer, arrayTokens);
            })
            .catch(reason => console.error(new Error(reason)));
    }

    private static sendNotification(uuidUser, annonce, timestampServer: number, arrayTokens: string[]) {
        // Je créé un tag pour pouvoir identifier la notification par la suite
        const tag = "without_photo_user_" + uuidUser + "_annonce_" + annonce.uuid + "_timestamp_" + timestampServer;

        // Je lance la notification de l'utilisateur
        sendNotification(arrayTokens, "Vendez efficacement", "Ajouter des photos à votre annonce peut attirer des acheteurs potentiels", tag, {})
            .then(value => {
                console.log("Relance faite au user " + uuidUser + " pour l annonce " + annonce.uuid);
                this.updateDateRelanceAnnonce(annonce, timestampServer);
            })
            .catch(reason => console.error(new Error(reason)));
    }

    private static updateDateRelanceAnnonce(annonce, timestampServer: number) {
        // Je vais mettre à jour la date de relance de l'annonce pour ne pas relancer l'utilisateur tout les jours.
        db.ref('/annonces/').child(annonce.uuid).child('dateRelance').set(timestampServer)
            .then(value1 => console.log('Annonce ' + annonce.uuid + ' a une nouvelle date de relance'))
            .catch(reason => console.error(new Error(reason)));
    }
}
