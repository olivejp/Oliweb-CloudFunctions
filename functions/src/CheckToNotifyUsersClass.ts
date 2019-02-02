import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import {
    daysInMilliseconds,
    DOMAIN_CLOUD_FUNCTION,
    getParams,
    getServerTimestamp,
    getTokens, PARAM_SANS_PHOTO_NB_JOUR_AP_RELANCE, PARAM_SANS_PHOTO_NB_JOUR_AV_RELANCE,
    sendNotification
} from "./Utility";

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
            .then(async datasnapshot => {

                // Récupération de la liste des annonces
                const annonces = datasnapshot.val();

                // Vérification que notre résultat est un array
                if (!Array.isArray(annonces)) {
                    return;
                }

                // Récupération du nombre de jour qu'on est censé attendre avant de lancer la notification
                // Si on avait déjà relancé la personne, on la relancera dans un délai un peu plus long pour ne pas la spammer.
                const nbJourAvantRelance = await getParams(DOMAIN_CLOUD_FUNCTION, PARAM_SANS_PHOTO_NB_JOUR_AV_RELANCE);
                const nbJourApresRelance = await getParams(DOMAIN_CLOUD_FUNCTION, PARAM_SANS_PHOTO_NB_JOUR_AP_RELANCE);

                // Parcourt de toutes les annonces
                for (const annonceDatasnapshot of annonces) {
                    this.checkDateAndSendNotificationIfNeeded(annonceDatasnapshot, timestampServer, nbJourAvantRelance, nbJourApresRelance);
                }
            })
            .catch(reason => console.error(new Error(reason)));
    }

    // Va rechercher la liste des annonces postées sans photos
    private static checkDateAndSendNotificationIfNeeded(annonceDatasnapshot: any, timestampServer: number, nbJourAvantRelance: number, nbJourApresRelance: number): void {
        // Récupération de l'objet Annonce
        const annonce = annonceDatasnapshot.val();

        // Si on a déjà une date de relance c'est elle qu'on va regarder, sinon ça sera la date de publication
        const isDateRelanceDefined = (annonce.dateRelance !== undefined && annonce.dateRelance && annonce.dateRelance > 0);
        const dateAComparer = (isDateRelanceDefined) ? annonce.dateRelance : annonce.datePublication;

        // Si l'annonce n'a pas de photos je vais regarder depuis quand elle a été postée
        if (!annonce.photos || annonce.photos.size === 0) {

            // Si la date à comparer est supérieure à 3 ou 10 jours
            if ((timestampServer - dateAComparer) > daysInMilliseconds((isDateRelanceDefined) ? nbJourApresRelance : nbJourAvantRelance)) {
                this.retrieveTokensAndSendNotification(annonce, timestampServer);
            }
        }
    }

    private static retrieveTokensAndSendNotification(annonce, timestampServer: number) {
        // L'annonce n'a pas de photos... je vais rechercher le token de l'utilisateur
        const uuidUser: string = annonce.utilisateur.uuid;
        getTokens(new Array(uuidUser))
            .then(arrayTokens => {
                this.sendNotification(uuidUser, annonce, timestampServer, arrayTokens);
            })
            .catch(reason => console.error(new Error(reason)));
    }

    private static sendNotification(uuidUser: string, annonce: any, timestampServer: number, arrayTokens: string[]) {
        // Je créé un tag pour pouvoir identifier la notification par la suite
        const tag = "without_photo_user_" + uuidUser + "_annonce_" + annonce.uuid + "_timestamp_" + timestampServer;

        // Je lance la notification de l'utilisateur
        sendNotification(arrayTokens, "Vendez efficacement", "Ajouter des photos à votre annonce peut attirer d'avantage d'acheteurs", tag, {})
            .then(value => {
                console.log("Relance faite au user " + uuidUser + " pour l'annonce " + annonce.uuid);
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
